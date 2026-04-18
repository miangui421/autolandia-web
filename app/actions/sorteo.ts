'use server';
import { createServerClient } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/admin-auth';
import { queryPool, type SorteoFiltros, type PoolEntry } from '@/lib/sorteo-pool';
import { pickWinners } from '@/lib/sorteo-random';
import { notifyTelegramSorteo } from '@/lib/notifications';

// ─── Preview ──────────────────────────────────────────────────
export interface PoolPreview {
  count: number;
  sampleNombres: string[];
}

export async function previewSorteoPool(filtros: SorteoFiltros): Promise<PoolPreview> {
  await requireAdmin();
  const pool = await queryPool(filtros);
  const sample = pool
    .slice(0, 5)
    .map((p) => {
      const parts = (p.nombre || '').trim().split(' ');
      const first = parts[0] || 'Sin nombre';
      const lastInitial = parts[parts.length - 1]?.[0] || '';
      return parts.length > 1 ? `${first} ${lastInitial}.` : first;
    });
  return { count: pool.length, sampleNombres: sample };
}

// ─── Create + execute ─────────────────────────────────────────
export interface CreateSorteoInput {
  titulo: string;
  premio_monto: number;
  premio_descripcion?: string;
  filtros: SorteoFiltros;
  ponderar_por_boletos: boolean;
  cantidad_ganadores: number;
}

export interface Winner {
  phone: string;
  nombre: string;
  ci: string;
  ticket_count: number;
  pick_order: number;
}

export interface CreateSorteoResult {
  success: boolean;
  error?: string;
  sorteo_id?: string;
}

async function generateSorteoId(supabase: ReturnType<typeof createServerClient>): Promise<string> {
  const { data } = await supabase
    .from('sorteos')
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  const next = (data?.id ?? 0) + 1;
  return `SORT-${String(next).padStart(3, '0')}`;
}

export async function createAndExecuteSorteo(input: CreateSorteoInput): Promise<CreateSorteoResult> {
  const { phone: adminPhone } = await requireAdmin();

  // Validaciones
  if (!input.titulo.trim()) return { success: false, error: 'Titulo requerido' };
  if (input.premio_monto <= 0) return { success: false, error: 'Premio debe ser > 0' };
  if (input.cantidad_ganadores < 1) return { success: false, error: 'Cantidad ganadores debe ser >= 1' };
  if (!input.filtros.fecha_desde || !input.filtros.fecha_hasta) {
    return { success: false, error: 'Rango de fecha requerido' };
  }

  // Pool snapshot
  let pool: PoolEntry[];
  try {
    pool = await queryPool(input.filtros);
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error consultando pool' };
  }
  if (pool.length < input.cantidad_ganadores) {
    return {
      success: false,
      error: `Pool insuficiente: ${pool.length} participantes para ${input.cantidad_ganadores} ganador(es)`,
    };
  }

  // Pick
  let winnerEntries: PoolEntry[];
  try {
    winnerEntries = pickWinners(pool, input.cantidad_ganadores, input.ponderar_por_boletos);
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error seleccionando ganadores' };
  }
  const ganadores: Winner[] = winnerEntries.map((w, i) => ({
    phone: w.phone,
    nombre: w.nombre,
    ci: w.ci,
    ticket_count: w.ticket_count,
    pick_order: i + 1,
  }));

  // Persist
  const supabase = createServerClient();
  const sorteoId = await generateSorteoId(supabase);

  const { error: insertError } = await supabase.from('sorteos').insert({
    sorteo_id: sorteoId,
    titulo: input.titulo.trim(),
    premio_monto: input.premio_monto,
    premio_descripcion: input.premio_descripcion?.trim() || null,
    filtros: input.filtros,
    ponderar_por_boletos: input.ponderar_por_boletos,
    cantidad_ganadores: input.cantidad_ganadores,
    pool_count: pool.length,
    pool_snapshot: pool.map((p) => ({ phone: p.phone, weight: p.ticket_count })),
    ganadores,
    estado: 'completado',
    creado_por_phone: adminPhone,
  });
  if (insertError) return { success: false, error: `DB insert error: ${insertError.message}` };

  // Notify Telegram (no bloquea)
  await notifyTelegramSorteo({
    sorteoId,
    titulo: input.titulo,
    premio: input.premio_monto,
    ganadores,
    poolCount: pool.length,
  }).catch((err) => console.error('notifyTelegramSorteo:', err));

  return { success: true, sorteo_id: sorteoId };
}

// ─── Mark paid ────────────────────────────────────────────────
export async function markSorteoPaid(
  sorteoId: string,
  referencia: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  const supabase = createServerClient();
  const { error } = await supabase
    .from('sorteos')
    .update({
      estado: 'pagado',
      pagado_at: new Date().toISOString(),
      pago_referencia: referencia.trim() || null,
    })
    .eq('sorteo_id', sorteoId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ─── Public audit ─────────────────────────────────────────────
export interface SorteoPublicData {
  sorteo_id: string;
  titulo: string;
  premio_monto: number;
  premio_descripcion: string | null;
  filtros: SorteoFiltros;
  ponderar_por_boletos: boolean;
  cantidad_ganadores: number;
  pool_count: number;
  ganadores: Array<{ nombre: string; phone_masked: string; ticket_count: number; pick_order: number }>;
  estado: string;
  created_at: string;
}

function maskPhone(phone: string): string {
  // 595981234567 → 098***4567
  const clean = (phone || '').replace(/\D/g, '');
  let local = clean;
  if (local.startsWith('595')) local = local.slice(3);
  if (local.length !== 9) return '***';
  return `0${local.slice(0, 2)}***${local.slice(-4)}`;
}

export async function getSorteoPublic(sorteoId: string): Promise<SorteoPublicData | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('sorteos')
    .select(
      'sorteo_id, titulo, premio_monto, premio_descripcion, filtros, ponderar_por_boletos, cantidad_ganadores, pool_count, ganadores, estado, created_at',
    )
    .eq('sorteo_id', sorteoId)
    .maybeSingle();
  if (!data) return null;
  const ganadores = ((data.ganadores as Winner[]) ?? []).map((g) => ({
    nombre: g.nombre,
    phone_masked: maskPhone(g.phone),
    ticket_count: g.ticket_count,
    pick_order: g.pick_order,
  }));
  return {
    sorteo_id: data.sorteo_id,
    titulo: data.titulo,
    premio_monto: data.premio_monto,
    premio_descripcion: data.premio_descripcion,
    filtros: data.filtros,
    ponderar_por_boletos: data.ponderar_por_boletos,
    cantidad_ganadores: data.cantidad_ganadores,
    pool_count: data.pool_count,
    ganadores,
    estado: data.estado,
    created_at: data.created_at,
  };
}

// ─── Admin-only list (dashboard) ──────────────────────────────
export interface SorteoListItem {
  sorteo_id: string;
  titulo: string;
  premio_monto: number;
  cantidad_ganadores: number;
  pool_count: number;
  estado: string;
  created_at: string;
  ganadores: Array<{ nombre: string; phone: string; ticket_count: number }>;
}

export async function listSorteos(): Promise<SorteoListItem[]> {
  await requireAdmin();
  const supabase = createServerClient();
  const { data } = await supabase
    .from('sorteos')
    .select('sorteo_id, titulo, premio_monto, cantidad_ganadores, pool_count, estado, created_at, ganadores')
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []).map((s) => ({
    sorteo_id: s.sorteo_id,
    titulo: s.titulo,
    premio_monto: s.premio_monto,
    cantidad_ganadores: s.cantidad_ganadores,
    pool_count: s.pool_count,
    estado: s.estado,
    created_at: s.created_at,
    ganadores: ((s.ganadores as Winner[]) ?? []).map((g) => ({
      nombre: g.nombre,
      phone: g.phone,
      ticket_count: g.ticket_count,
    })),
  }));
}

// ─── Admin-only fetch of one (for execution page, includes ganadores con phone normal) ──
export async function getSorteoAdmin(sorteoId: string): Promise<{
  sorteo_id: string;
  titulo: string;
  premio_monto: number;
  premio_descripcion: string | null;
  filtros: SorteoFiltros;
  ponderar_por_boletos: boolean;
  cantidad_ganadores: number;
  pool_count: number;
  ganadores: Winner[];
  pool_sample_names: string[];
  estado: string;
  pago_referencia: string | null;
  created_at: string;
} | null> {
  await requireAdmin();
  const supabase = createServerClient();
  const { data } = await supabase
    .from('sorteos')
    .select('*')
    .eq('sorteo_id', sorteoId)
    .maybeSingle();
  if (!data) return null;

  // Extraer sample de nombres para animación del slot (privacidad: primer nombre + inicial)
  const winnerPhones = new Set((data.ganadores as Winner[]).map((w) => w.phone));
  const sampleSize = Math.min(30, data.pool_count);
  const snapshot = data.pool_snapshot as { phone: string; weight: number }[];

  // Necesitamos los nombres de una muestra del pool. Los obtenemos de ventas
  // con un query adicional usando los phones del snapshot.
  const samplePhones = snapshot
    .filter((s) => !winnerPhones.has(s.phone))
    .slice(0, sampleSize)
    .map((s) => s.phone);

  let poolSampleNames: string[] = [];
  if (samplePhones.length > 0) {
    // Generar todas las variantes de cada phone para el query IN
    const variants: string[] = [];
    for (const p of samplePhones) {
      const local = p.replace(/^595/, '');
      variants.push(p, '0' + local, local, '+' + p);
    }
    const { data: ventas } = await supabase
      .from('ventas')
      .select('telefono, telefono_registro, nombre_completo')
      .in('telefono', variants)
      .limit(sampleSize * 2);
    const seen = new Set<string>();
    for (const v of ventas ?? []) {
      const nombre = (v.nombre_completo as string) || '';
      if (!nombre) continue;
      const parts = nombre.trim().split(' ');
      const display = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
      if (!seen.has(display)) {
        seen.add(display);
        poolSampleNames.push(display);
      }
    }
  }
  if (poolSampleNames.length === 0) {
    poolSampleNames = ['Participante 1', 'Participante 2', 'Participante 3'];
  }

  return {
    sorteo_id: data.sorteo_id,
    titulo: data.titulo,
    premio_monto: data.premio_monto,
    premio_descripcion: data.premio_descripcion,
    filtros: data.filtros,
    ponderar_por_boletos: data.ponderar_por_boletos,
    cantidad_ganadores: data.cantidad_ganadores,
    pool_count: data.pool_count,
    ganadores: data.ganadores as Winner[],
    pool_sample_names: poolSampleNames,
    estado: data.estado,
    pago_referencia: data.pago_referencia,
    created_at: data.created_at,
  };
}
