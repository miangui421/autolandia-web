'use server';
import { createServerClient } from '@/lib/supabase-server';

export interface Promo3x1Eligibility {
  eligible: boolean;
  reason?: 'already_used';
}

function phoneVariants(phone: string): string[] {
  const clean = phone.replace(/\D/g, '');
  const variants = new Set<string>();
  let local = clean;
  if (local.startsWith('595')) local = local.slice(3);
  if (local.startsWith('0')) local = local.slice(1);
  if (local) {
    variants.add(local);
    variants.add('0' + local);
    variants.add('595' + local);
    variants.add('+595' + local);
  }
  return Array.from(variants);
}

export async function checkPromo3x1Eligibility(telefono: string): Promise<Promo3x1Eligibility> {
  const supabase = createServerClient();
  const variants = phoneVariants(telefono);
  if (variants.length === 0) return { eligible: true };

  const [byTel, byTelReg] = await Promise.all([
    supabase.from('ventas').select('ticket_id').eq('is_promo_3x1', true).in('telefono', variants).limit(1),
    supabase.from('ventas').select('ticket_id').eq('is_promo_3x1', true).in('telefono_registro', variants).limit(1),
  ]);

  const used = (byTel.data?.length ?? 0) > 0 || (byTelReg.data?.length ?? 0) > 0;
  return used ? { eligible: false, reason: 'already_used' } : { eligible: true };
}
