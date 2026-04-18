import { createServerClient } from './supabase-server';

export interface SorteoFiltros {
  fecha_desde: string; // YYYY-MM-DD
  fecha_hasta: string;
  min_boletos?: number;
  canal?: 'web' | 'bot' | 'cualquiera';
  excluir_prev_ganadores?: boolean;
}

export interface PoolEntry {
  phone: string; // 595XXXXXXXXX
  nombre: string;
  ci: string;
  ticket_count: number;
}

function normalizePhone(raw: string): string {
  const clean = (raw || '').replace(/\D/g, '');
  let local = clean;
  if (local.startsWith('595')) local = local.slice(3);
  if (local.startsWith('0')) local = local.slice(1);
  return local ? '595' + local : '';
}

export async function queryPool(filtros: SorteoFiltros): Promise<PoolEntry[]> {
  const supabase = createServerClient();
  let q = supabase
    .from('ventas')
    .select('telefono, telefono_registro, nombre_completo, ci, cantidad, mensaje_inicial, fecha')
    .gte('fecha', `${filtros.fecha_desde}T00:00:00`)
    .lte('fecha', `${filtros.fecha_hasta}T23:59:59`);

  if (filtros.canal === 'web') q = q.eq('mensaje_inicial', 'WEB');
  else if (filtros.canal === 'bot') q = q.neq('mensaje_inicial', 'WEB');

  const { data, error } = await q;
  if (error) throw new Error(`Error consultando pool: ${error.message}`);

  const map = new Map<string, PoolEntry>();
  for (const v of data ?? []) {
    const norm = normalizePhone((v.telefono as string) || (v.telefono_registro as string) || '');
    if (!norm) continue;
    const existing = map.get(norm);
    if (existing) {
      existing.ticket_count += v.cantidad;
      if (!existing.nombre && v.nombre_completo) existing.nombre = v.nombre_completo;
      if (!existing.ci && v.ci) existing.ci = v.ci;
    } else {
      map.set(norm, {
        phone: norm,
        nombre: v.nombre_completo || '',
        ci: v.ci || '',
        ticket_count: v.cantidad,
      });
    }
  }

  let pool = Array.from(map.values());
  if (filtros.min_boletos && filtros.min_boletos > 0) {
    pool = pool.filter((p) => p.ticket_count >= filtros.min_boletos!);
  }

  if (filtros.excluir_prev_ganadores) {
    const { data: sorteos } = await supabase.from('sorteos').select('ganadores');
    const prevWinners = new Set<string>();
    for (const s of sorteos ?? []) {
      const gs = (s.ganadores as { phone: string }[]) ?? [];
      for (const g of gs) prevWinners.add(g.phone);
    }
    pool = pool.filter((p) => !prevWinners.has(p.phone));
  }

  return pool;
}
