'use server';
import { generateSecret, generateURI, verifySync } from 'otplib';
import qrcode from 'qrcode';
import { decryptSecret, encryptSecret } from '@/lib/admin-crypto';
import { createServerClient } from '@/lib/supabase-server';
import { setTotpCookie } from '@/lib/admin-auth';

export interface EnrollInput {
  phone: string;
  nombre: string;
  bootstrapToken: string;
}

export interface EnrollResult {
  success: boolean;
  error?: string;
  qrDataUrl?: string;
  secret?: string;
}

export async function enrollAdmin(input: EnrollInput): Promise<EnrollResult> {
  const expected = process.env.ADMIN_BOOTSTRAP_TOKEN;
  if (!expected || expected === 'DEACTIVATED' || input.bootstrapToken !== expected) {
    return { success: false, error: 'Token invalido o enrollment desactivado' };
  }
  if (!/^595\d{9}$/.test(input.phone)) {
    return { success: false, error: 'Telefono debe ser formato 595XXXXXXXXX' };
  }
  if (!input.nombre.trim()) {
    return { success: false, error: 'Nombre requerido' };
  }

  const secret = generateSecret();
  const encrypted = encryptSecret(secret);
  const supabase = createServerClient();
  const { error } = await supabase.from('admin_users').upsert(
    {
      phone: input.phone,
      nombre: input.nombre.trim(),
      totp_secret_encrypted: encrypted,
      failed_totp_attempts: 0,
      locked_until: null,
    },
    { onConflict: 'phone' },
  );
  if (error) return { success: false, error: `DB error: ${error.message}` };

  const otpauth = generateURI({
    strategy: 'totp',
    issuer: 'Autolandia Admin',
    label: input.phone,
    secret,
  });
  const qrDataUrl = await qrcode.toDataURL(otpauth);
  return { success: true, qrDataUrl, secret };
}

export interface VerifyResult {
  ok: boolean;
  error?: string;
  attemptsRemaining?: number;
}

export async function verifyTotp(phone: string, code: string): Promise<VerifyResult> {
  if (!/^\d{6}$/.test(code)) return { ok: false, error: 'Codigo debe tener 6 digitos' };
  if (!/^595\d{9}$/.test(phone)) return { ok: false, error: 'Telefono invalido' };

  const supabase = createServerClient();
  const { data } = await supabase
    .from('admin_users')
    .select('totp_secret_encrypted, failed_totp_attempts, locked_until')
    .eq('phone', phone)
    .maybeSingle();
  if (!data) return { ok: false, error: 'No eres admin' };

  if (data.locked_until && new Date(data.locked_until) > new Date()) {
    return { ok: false, error: 'Cuenta bloqueada temporalmente. Intenta en unos minutos.' };
  }

  const secret = decryptSecret(data.totp_secret_encrypted);
  const result = verifySync({
    token: code,
    secret,
    strategy: 'totp',
    epochTolerance: 30, // ±30s = ±1 periodo TOTP
  });

  if (!result.valid) {
    const attempts = (data.failed_totp_attempts ?? 0) + 1;
    const update: { failed_totp_attempts: number; locked_until?: string | null } = {
      failed_totp_attempts: attempts,
    };
    if (attempts >= 5) {
      update.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      update.failed_totp_attempts = 0;
    }
    await supabase.from('admin_users').update(update).eq('phone', phone);
    const remaining = Math.max(0, 5 - attempts);
    return {
      ok: false,
      error: remaining > 0 ? 'Codigo invalido' : 'Demasiados intentos. Bloqueado 15 minutos.',
      attemptsRemaining: remaining,
    };
  }

  await supabase
    .from('admin_users')
    .update({ failed_totp_attempts: 0, locked_until: null })
    .eq('phone', phone);
  await setTotpCookie(phone);
  return { ok: true };
}
