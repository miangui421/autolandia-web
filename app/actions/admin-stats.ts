'use server';
import { createServerClient } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/admin-auth';

export interface DailySale {
  date: string; // YYYY-MM-DD
  ventas_count: number;
  boletos: number;
  monto: number;
}

export interface CanalStats {
  ventas: number;
  total_gs: number;
}

export type PorCanal = Record<string, CanalStats>;

export interface AdminStats {
  total_recaudado: number;
  total_ventas: number;
  total_boletos: number;
  boletos_vendidos: number;
  boletos_totales: number;
  ultima_venta_fecha: string | null;
  daily_sales: DailySale[];
  por_canal: PorCanal;
}

/**
 * Trae los stats via RPC Postgres get_admin_stats(). Server-side aggregation
 * evita el limite default de PostgREST (1000 rows) y es mas rapido que traer
 * toda la tabla. Sin este RPC, los totales se truncaban al primer 1000.
 */
export async function getAdminStats(rangeDays: 7 | 30 | 0): Promise<AdminStats> {
  await requireAdmin();
  const supabase = createServerClient();

  const { data, error } = await supabase.rpc('get_admin_stats', { p_range_days: rangeDays });
  if (error) throw new Error(`Error stats: ${error.message}`);

  const raw = data as {
    total_recaudado: number | string;
    total_ventas: number;
    total_boletos: number | string;
    boletos_vendidos: number;
    boletos_totales: number;
    ultima_venta_fecha: string | null;
    daily_sales: DailySale[] | null;
    por_canal: Record<string, { ventas: number | string; total_gs: number | string }> | null;
  };

  const porCanal: PorCanal = {};
  if (raw.por_canal && typeof raw.por_canal === 'object') {
    for (const [canal, stats] of Object.entries(raw.por_canal)) {
      porCanal[canal] = {
        ventas: Number(stats?.ventas) || 0,
        total_gs: Number(stats?.total_gs) || 0,
      };
    }
  }

  return {
    total_recaudado: Number(raw.total_recaudado) || 0,
    total_ventas: Number(raw.total_ventas) || 0,
    total_boletos: Number(raw.total_boletos) || 0,
    boletos_vendidos: Number(raw.boletos_vendidos) || 0,
    boletos_totales: Number(raw.boletos_totales) || 0,
    ultima_venta_fecha: raw.ultima_venta_fecha,
    daily_sales: Array.isArray(raw.daily_sales)
      ? raw.daily_sales.map((d) => ({
          date: d.date,
          ventas_count: Number(d.ventas_count) || 0,
          boletos: Number(d.boletos) || 0,
          monto: Number(d.monto) || 0,
        }))
      : [],
    por_canal: porCanal,
  };
}
