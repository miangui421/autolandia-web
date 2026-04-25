'use server';
import { cookies } from 'next/headers';
import { sendVerification, checkVerification } from '@/lib/twilio';
import { createServerClient } from '@/lib/supabase-server';
import { appendLeadToSheets } from '@/lib/notifications';
import { sendMetaEvent } from '@/lib/meta-capi';
import { UTM_COOKIE_NAME, parseUtmCookie } from '@/lib/utm-tracking';

/**
 * Envía un OTP al teléfono via Twilio Verify Service.
 * Twilio genera el código automáticamente y envía SMS con branding "Autolandia".
 */
export async function sendOtp(phone: string): Promise<{ success: boolean; error?: string }> {
  if (!phone || !phone.startsWith('+')) {
    return { success: false, error: 'Numero invalido. Debe estar en formato internacional.' };
  }
  return sendVerification(phone);
}

/**
 * Verifica el código OTP contra Twilio Verify.
 * Si es válido: crea/obtiene el usuario en Supabase y genera un magic link
 * que el cliente consume para establecer la sesión.
 */
export async function verifyOtpAndGetToken(
  phone: string,
  code: string,
): Promise<{
  success: boolean;
  error?: string;
  actionLink?: string;
  hasProfile?: boolean;
}> {
  // 1. Validar con Twilio Verify
  const verification = await checkVerification(phone, code);
  if (!verification.approved) {
    return { success: false, error: verification.error || 'Codigo incorrecto' };
  }

  const supabase = createServerClient();
  const cleanPhone = phone.replace('+', '');
  const internalEmail = `user.${cleanPhone}@autolandia.internal`;

  // 2. Buscar si el usuario ya existe (por el email interno)
  const { data: existing } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  let user = existing?.users.find(
    (u) => u.email === internalEmail || u.phone === cleanPhone,
  );

  // 3. Crear usuario si no existe
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: internalEmail,
      phone: cleanPhone,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: { telefono: cleanPhone },
    });
    if (error) {
      console.error('Error creando usuario:', error.message);
      return { success: false, error: 'Error creando tu cuenta. Intenta de nuevo.' };
    }
    user = data.user;
  } else if (!user.user_metadata?.telefono) {
    // User existe pero no tiene telefono en metadata (legacy): lo agregamos
    await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, telefono: cleanPhone },
    });
  }

  // 4. Generar magic link para auto-login
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: internalEmail,
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.error('Error generando link:', linkError?.message);
    return { success: false, error: 'Error iniciando sesion. Intenta de nuevo.' };
  }

  // 5. Track lead (NUEVO si no existe, actualizar last_contact_at si existe)
  // No degradamos el stage: si ya es COMPRADOR/RECURRENTE lo mantenemos.
  const { data: existingLead } = await supabase
    .from('leads')
    .select('phone, stage')
    .eq('phone', cleanPhone)
    .maybeSingle();

  if (!existingLead) {
    // First-touch: capturar UTMs de cookie solo al crear el lead (nunca se sobreescriben)
    const cookieStore = await cookies();
    const utm = parseUtmCookie(cookieStore.get(UTM_COOKIE_NAME)?.value);

    await supabase.from('leads').insert({
      phone: cleanPhone,
      stage: 'NUEVO',
      first_contact_at: new Date().toISOString(),
      last_contact_at: new Date().toISOString(),
      total_purchases: 0,
      total_spent: 0,
      utm_source: utm?.source,
      utm_medium: utm?.medium,
      utm_campaign: utm?.campaign,
      utm_content: utm?.content,
      utm_term: utm?.term,
      utm_landing_page: utm?.landing_page,
      utm_first_visit_at: utm?.first_visit_at,
    });
  } else {
    // Solo actualizar last_contact_at, no tocar stage ni totales ni UTMs (first-touch)
    await supabase
      .from('leads')
      .update({ last_contact_at: new Date().toISOString() })
      .eq('phone', cleanPhone);
  }

  // Perfil completo = tiene nombre Y CI
  const hasProfile = !!(user?.user_metadata?.nombre && user?.user_metadata?.ci);

  // Si el user ya tiene perfil completo pero nunca se registró en la hoja
  // "Leads Web" (users legacy de antes del tracking), registrarlo ahora.
  if (hasProfile && !user?.user_metadata?.sheet_registered) {
    const leadRow = {
      fecha: new Date().toLocaleString('sv-SE', { timeZone: 'America/Asuncion' }),
      telefono: cleanPhone,
      nombreCompleto: user.user_metadata.nombre,
      ci: user.user_metadata.ci,
      canal: 'WEB',
      stage: existingLead?.stage || 'NUEVO',
    };
    await appendLeadToSheets(leadRow).catch(console.error);
    await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, sheet_registered: true },
    });
  }

  return {
    success: true,
    actionLink: linkData.properties.action_link,
    hasProfile,
  };
}

/**
 * Registra en Google Sheets + Telegram que un lead completo su perfil en la web.
 * Se llama DESPUES de que el cliente actualizo el user_metadata con nombre y CI.
 *
 * Idempotencia: usa el flag sheet_registered en user_metadata. Si ya esta seteado,
 * no registra de nuevo (evita duplicados si el user edita su perfil).
 */
export async function trackLeadCompleted(
  telefono: string,
  nombre: string,
  ci: string,
  eventId?: string,
): Promise<{ success: boolean }> {
  const cleanPhone = telefono.replace(/\D/g, '');
  const supabase = createServerClient();

  // 1. Buscar user por telefono/email interno
  const internalEmail = `user.${cleanPhone}@autolandia.internal`;
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === internalEmail);

  if (!user) {
    return { success: false };
  }

  // 2. Si ya se registro en el sheet antes, no duplicar
  if (user.user_metadata?.sheet_registered) {
    return { success: true };
  }

  // 3. Registrar en Google Sheets + notificar Telegram (ambos async, non-blocking)
  const leadRow = {
    fecha: new Date().toLocaleString('sv-SE', { timeZone: 'America/Asuncion' }),
    telefono: cleanPhone,
    nombreCompleto: nombre,
    ci,
    canal: 'WEB',
    stage: 'NUEVO',
  };

  await appendLeadToSheets(leadRow);

  // 3b. CAPI Lead (fire-and-forget, solo primera vez, respeta sheet_registered idempotency)
  if (eventId) {
    await Promise.allSettled([
      sendMetaEvent({
        eventName: 'Lead',
        eventId,
        eventSourceUrl: 'https://autolandia.com.py/login',
        phone: cleanPhone,
        nombreCompleto: nombre,
      }),
    ]);
  }

  // 4. Marcar el flag para no re-registrar
  await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, sheet_registered: true },
  });

  return { success: true };
}
