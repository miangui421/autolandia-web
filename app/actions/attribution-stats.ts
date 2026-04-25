'use server';
import { createServerClient } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/admin-auth';

export interface AttributionRow {
  source: string;
  campaign: string;
  ventas_count: number;
  total_gs: number;
  pct_total: number;
}

/**
 * Trae ventas agrupadas por (utm_source, utm_campaign) en el rango pedido.
 * Ventas sin UTMs se agrupan como source='direct', campaign='-'.
 */
export async function getAttributionStats(rangeDays: 7 | 30 | 0): Promise<AttributionRow[]> {
  await requireAdmin();
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc('get_attribution_stats', { p_range_days: rangeDays });
  if (error) throw new Error(`Error attribution stats: ${error.message}`);

  if (!Array.isArray(data)) return [];

  return data.map((row) => ({
    source: String(row.source ?? 'direct'),
    campaign: String(row.campaign ?? '-'),
    ventas_count: Number(row.ventas_count) || 0,
    total_gs: Number(row.total_gs) || 0,
    pct_total: Number(row.pct_total) || 0,
  }));
}
