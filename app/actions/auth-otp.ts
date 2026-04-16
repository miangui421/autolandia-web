'use server';
import { sendVerification, checkVerification } from '@/lib/twilio';
import { createServerClient } from '@/lib/supabase-server';

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
    await supabase.from('leads').insert({
      phone: cleanPhone,
      stage: 'NUEVO',
      first_contact_at: new Date().toISOString(),
      last_contact_at: new Date().toISOString(),
      total_purchases: 0,
      total_spent: 0,
    });
  } else {
    // Solo actualizar last_contact_at, no tocar stage ni totales
    await supabase
      .from('leads')
      .update({ last_contact_at: new Date().toISOString() })
      .eq('phone', cleanPhone);
  }

  // Perfil completo = tiene nombre Y CI
  const hasProfile = !!(user?.user_metadata?.nombre && user?.user_metadata?.ci);

  return {
    success: true,
    actionLink: linkData.properties.action_link,
    hasProfile,
  };
}

/**
 * Guarda el nombre del usuario en su metadata.
 */
export async function saveUserProfile(nombre: string): Promise<{ success: boolean; error?: string }> {
  if (!nombre.trim()) {
    return { success: false, error: 'El nombre es obligatorio' };
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Sesion no valida' };
  }

  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, nombre: nombre.trim() },
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}
