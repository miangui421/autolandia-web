'use server';
import { createServerClient } from '@/lib/supabase-server';

export interface UserPurchase {
  ticket_id: string;
  fecha: string;
  cantidad: number;
  monto: number;
  numeros_asignados: number[];
  metodo_pago: string;
}

/**
 * Genera todas las variantes posibles de un teléfono paraguayo.
 * Las ventas tienen teléfonos guardados en distintos formatos (legacy del bot):
 * - Local con 0: 0992673304
 * - Local sin 0: 992673304
 * - Internacional sin +: 595992673304
 * - Internacional con +: +595992673304
 */
function phoneVariants(phone: string): string[] {
  const clean = phone.replace(/\D/g, '');
  const variants = new Set<string>();

  // Extraer el número local (sin código país ni 0 inicial)
  let local = clean;
  if (local.startsWith('595')) local = local.slice(3);
  if (local.startsWith('0')) local = local.slice(1);

  if (local) {
    variants.add(local); // 992673304
    variants.add('0' + local); // 0992673304
    variants.add('595' + local); // 595992673304
    variants.add('+595' + local); // +595992673304
  }

  return Array.from(variants);
}

export async function getUserPurchases(telefono: string): Promise<UserPurchase[]> {
  const supabase = createServerClient();
  const variants = phoneVariants(telefono);

  console.log('[getUserPurchases] telefono recibido:', telefono);
  console.log('[getUserPurchases] variantes generadas:', variants);

  if (variants.length === 0) return [];

  // Hacemos dos queries (una por columna) y combinamos para evitar problemas
  // con el parsing de `.or()` cuando los valores contienen caracteres especiales
  const [byTel, byTelReg] = await Promise.all([
    supabase
      .from('ventas')
      .select('ticket_id, fecha, cantidad, monto, numeros_asignados, metodo_pago')
      .in('telefono', variants),
    supabase
      .from('ventas')
      .select('ticket_id, fecha, cantidad, monto, numeros_asignados, metodo_pago')
      .in('telefono_registro', variants),
  ]);

  console.log('[getUserPurchases] byTel rows:', byTel.data?.length, 'error:', byTel.error);
  console.log('[getUserPurchases] byTelReg rows:', byTelReg.data?.length, 'error:', byTelReg.error);

  if (byTel.error && byTelReg.error) {
    console.error('getUserPurchases error:', byTel.error, byTelReg.error);
    return [];
  }

  // Merge y deduplicate por ticket_id
  const seen = new Set<string>();
  const merged: UserPurchase[] = [];
  for (const row of [...(byTel.data || []), ...(byTelReg.data || [])]) {
    if (!seen.has(row.ticket_id)) {
      seen.add(row.ticket_id);
      merged.push(row);
    }
  }

  // Ordenar por fecha desc
  merged.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  return merged;
}

export interface UserStats {
  totalBoletos: number;
  totalGastado: number;
  totalCompras: number;
}

export async function getUserStats(telefono: string): Promise<UserStats> {
  const purchases = await getUserPurchases(telefono);

  return {
    totalBoletos: purchases.reduce((sum, p) => sum + p.cantidad, 0),
    totalGastado: purchases.reduce((sum, p) => sum + p.monto, 0),
    totalCompras: purchases.length,
  };
}
