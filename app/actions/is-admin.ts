'use server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * Retorna si el telefono esta en la whitelist de admins.
 * Seguro: no expone ningun detalle del admin, solo boolean.
 * Llamar desde client components que ya saben el phone del user logueado.
 */
export async function isAdminPhone(phone: string): Promise<boolean> {
  if (!/^595\d{9}$/.test(phone)) return false;
  const supabase = createServerClient();
  const { data } = await supabase
    .from('admin_users')
    .select('phone')
    .eq('phone', phone)
    .maybeSingle();
  return !!data;
}
