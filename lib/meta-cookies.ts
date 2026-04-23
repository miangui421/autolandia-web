// lib/meta-cookies.ts
import { cookies } from 'next/headers';

/**
 * Lee la cookie _fbp (Meta Pixel browser cookie).
 * La setea el pixel automáticamente la primera vez que corre en el browser.
 * Devuelve undefined si no está presente.
 */
export async function getFbp(): Promise<string | undefined> {
  const store = await cookies();
  return store.get('_fbp')?.value;
}

/**
 * Lee la cookie _fbc (Meta Pixel click ID cookie).
 * La setea el middleware cuando detecta ?fbclid= en una request.
 * Formato: fb.1.{timestamp_ms}.{fbclid}.
 */
export async function getFbc(): Promise<string | undefined> {
  const store = await cookies();
  return store.get('_fbc')?.value;
}
