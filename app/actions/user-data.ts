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

export async function getUserPurchases(telefono: string): Promise<UserPurchase[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('ventas')
    .select('ticket_id, fecha, cantidad, monto, numeros_asignados, metodo_pago')
    .or(`telefono.eq.${telefono},telefono_registro.eq.${telefono}`)
    .order('fecha', { ascending: false });

  if (error) return [];
  return data || [];
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
