'use server';
import { createServerClient } from '@/lib/supabase-server';
import type { RaffleNumber } from '@/types';
import { MAX_NUMERO } from '@/lib/constants';

export async function lookupNumbers(search: number, limit: number = 20): Promise<RaffleNumber[]> {
  if (search < 1 || search > MAX_NUMERO) return [];

  const supabase = createServerClient();
  const half = Math.floor(limit / 2);
  const from = Math.max(1, search - half);
  const to = Math.min(MAX_NUMERO, search + half);

  const { data, error } = await supabase
    .from('rifas')
    .select('numero, estado, reservado_hasta')
    .gte('numero', from)
    .lte('numero', to)
    .order('numero');

  if (error) throw new Error('Error buscando numeros');

  const now = new Date().toISOString();
  return (data || []).map((r: { numero: number; estado: string; reservado_hasta: string | null }) => ({
    numero: r.numero,
    disponible: r.estado === 'LIBRE' && (!r.reservado_hasta || r.reservado_hasta < now),
  }));
}
