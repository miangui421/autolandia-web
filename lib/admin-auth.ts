import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHmac, timingSafeEqual } from 'crypto';
import { createServerClient } from './supabase-server';

const COOKIE_NAME = 'admin_totp_ok';
const COOKIE_MAX_AGE_SEC = 12 * 60 * 60;

function sign(value: string): string {
  const secret = process.env.ADMIN_TOTP_COOKIE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('ADMIN_TOTP_COOKIE_SECRET must be set and >= 32 chars');
  }
  return createHmac('sha256', secret).update(value).digest('hex');
}

export async function setTotpCookie(phone: string): Promise<void> {
  const value = `${phone}.${Date.now()}`;
  const sig = sign(value);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `${value}.${sig}`, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE_SEC,
    path: '/',
  });
}

export async function clearTotpCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

function verifyTotpCookieValue(raw: string | undefined, expectedPhone: string): boolean {
  if (!raw) return false;
  const parts = raw.split('.');
  if (parts.length !== 3) return false;
  const [phone, ts, sig] = parts;
  if (phone !== expectedPhone) return false;
  const expected = sign(`${phone}.${ts}`);
  const sigBuf = Buffer.from(sig, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length) return false;
  if (!timingSafeEqual(sigBuf, expBuf)) return false;
  const ageSec = (Date.now() - parseInt(ts, 10)) / 1000;
  if (Number.isNaN(ageSec) || ageSec > COOKIE_MAX_AGE_SEC) return false;
  return true;
}

export async function hasValidTotpCookie(expectedPhone: string): Promise<boolean> {
  const cookieStore = await cookies();
  return verifyTotpCookieValue(cookieStore.get(COOKIE_NAME)?.value, expectedPhone);
}

export async function isWhitelistedAdmin(phone: string): Promise<{ ok: boolean; nombre?: string }> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('admin_users')
    .select('phone, nombre')
    .eq('phone', phone)
    .maybeSingle();
  if (!data) return { ok: false };
  return { ok: true, nombre: data.nombre };
}

/**
 * Extrae phone del user. Los users pueden tener telefono en user_metadata o
 * en el email interno user.XXX@autolandia.internal. Normaliza a 595XXXXXXXXX.
 */
export function extractPhone(user: {
  phone?: string | null;
  email?: string | null;
  user_metadata?: { telefono?: string | null } | null;
}): string {
  let raw = user.user_metadata?.telefono || user.phone || '';
  if (!raw && user.email?.endsWith('@autolandia.internal')) {
    const m = user.email.match(/user\.(\d+)@/);
    if (m) raw = m[1];
  }
  const clean = (raw || '').replace(/\D/g, '');
  let local = clean;
  if (local.startsWith('595')) local = local.slice(3);
  if (local.startsWith('0')) local = local.slice(1);
  return local ? '595' + local : '';
}

/**
 * Para usar en server components y server actions. La cookie TOTP es la prueba
 * de admin: esta firmada server-side con HMAC, incluye el phone, expira en 12h.
 * Si no esta presente/valida, redirige a /admin/login (que maneja el caso de
 * sesion Supabase faltante y pide el codigo TOTP).
 *
 * Defense in depth: ademas de verificar la firma y expiry, re-verifica que el
 * phone siga en admin_users (por si lo removiste de la whitelist).
 */
export async function requireAdmin(): Promise<{ phone: string; nombre: string }> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) redirect('/admin/login');

  const parts = raw.split('.');
  if (parts.length !== 3) redirect('/admin/login');
  const [phone, ts, sig] = parts;

  const expected = sign(`${phone}.${ts}`);
  let sigBuf: Buffer;
  let expBuf: Buffer;
  try {
    sigBuf = Buffer.from(sig, 'hex');
    expBuf = Buffer.from(expected, 'hex');
  } catch {
    redirect('/admin/login');
  }
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    redirect('/admin/login');
  }

  const ageSec = (Date.now() - parseInt(ts, 10)) / 1000;
  if (Number.isNaN(ageSec) || ageSec > COOKIE_MAX_AGE_SEC) {
    redirect('/admin/login');
  }

  const admin = await isWhitelistedAdmin(phone);
  if (!admin.ok) redirect('/admin/login');

  return { phone, nombre: admin.nombre! };
}
