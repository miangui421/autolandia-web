'use server';
import { createServerClient } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/admin-auth';

export interface DailySale {
  date: string; // YYYY-MM-DD
  ventas_count: number;
  boletos: number;
  monto: number;
}

export interface AdminStats {
  total_recaudado: number;
  total_ventas: number;
  total_boletos: number;
  boletos_vendidos: number;
  boletos_totales: number;
  ultima_venta_fecha: string | null;
  daily_sales: DailySale[];
}

export async function getAdminStats(rangeDays: 7 | 30 | 0): Promise<AdminStats> {
  await requireAdmin();
  const supabase = createServerClient();

  const [totalesRes, rifasRes, ventasDiariasRes, ultimaRes] = await Promise.all([
    supabase.from('ventas').select('monto, cantidad'),
    supabase.from('rifas').select('estado'),
    (async () => {
      let q = supabase.from('ventas').select('fecha, monto, cantidad');
      if (rangeDays > 0) {
        const since = new Date(Date.now() - rangeDays * 86400000).toISOString();
        q = q.gte('fecha', since);
      }
      return q;
    })(),
    supabase.from('ventas').select('fecha').order('fecha', { ascending: false }).limit(1).maybeSingle(),
  ]);

  // Totales acumulados (siempre all-time, no filtrados por rango)
  const ventasAll = totalesRes.data ?? [];
  const total_recaudado = ventasAll.reduce((s, v) => s + (Number(v.monto) || 0), 0);
  const total_ventas = ventasAll.length;
  const total_boletos = ventasAll.reduce((s, v) => s + (Number(v.cantidad) || 0), 0);

  // Pool
  const rifas = rifasRes.data ?? [];
  const boletos_vendidos = rifas.filter((r) => r.estado === 'VENDIDO').length;
  const boletos_totales = rifas.length;

  // Daily sales (por rango)
  const bucket = new Map<string, { ventas: number; boletos: number; monto: number }>();
  for (const v of ventasDiariasRes.data ?? []) {
    // fecha es timestamp sin TZ; el web graba Paraguay time, el bot graba Paraguay tambien en runtime
    // Usamos los primeros 10 chars de la fecha ISO como YYYY-MM-DD
    const d = String(v.fecha).slice(0, 10);
    const existing = bucket.get(d) ?? { ventas: 0, boletos: 0, monto: 0 };
    existing.ventas += 1;
    existing.boletos += Number(v.cantidad) || 0;
    existing.monto += Number(v.monto) || 0;
    bucket.set(d, existing);
  }
  const daily_sales: DailySale[] = Array.from(bucket.entries())
    .map(([date, d]) => ({ date, ventas_count: d.ventas, boletos: d.boletos, monto: d.monto }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    total_recaudado,
    total_ventas,
    total_boletos,
    boletos_vendidos,
    boletos_totales,
    ultima_venta_fecha: ultimaRes.data?.fecha ? String(ultimaRes.data.fecha) : null,
    daily_sales,
  };
}
