'use server';
import { createServerClient } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/admin-auth';
import { deleteSaleFromSheets, notifyTelegramTicketDeleted } from '@/lib/notifications';

export interface TicketRow {
  id: number;
  ticket_id: string;
  nombre_completo: string;
  ci: string;
  telefono: string;
  cantidad: number;
  monto: number;
  numeros_asignados: number[];
  fecha: string;
  metodo_pago: string;
}

export async function searchTickets(query: string): Promise<TicketRow[]> {
  await requireAdmin();
  const q = query.trim();
  if (!q) return [];

  const supabase = createServerClient();
  const isTicketId = /^TK-\d+$/i.test(q);

  let builder = supabase
    .from('ventas')
    .select('id, ticket_id, nombre_completo, ci, telefono, cantidad, monto, numeros_asignados, fecha, metodo_pago');

  if (isTicketId) {
    builder = builder.ilike('ticket_id', q);
  } else {
    // Buscar por telefono o CI (ilike, parcial)
    const clean = q.replace(/\D/g, '');
    // Si parece un numero largo, tratamos como telefono
    if (clean.length >= 6) {
      builder = builder.or(`telefono.ilike.%${clean}%,telefono_registro.ilike.%${clean}%,ci.ilike.%${q}%,nombre_completo.ilike.%${q}%`);
    } else {
      builder = builder.or(`ci.ilike.%${q}%,nombre_completo.ilike.%${q}%`);
    }
  }

  const { data, error } = await builder.order('fecha', { ascending: false }).limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as TicketRow[];
}

export interface DeleteTicketResult {
  success: boolean;
  error?: string;
  numerosLiberados?: number;
  sheetsDeleted?: boolean;
}

export async function deleteTicket(ticketId: string): Promise<DeleteTicketResult> {
  const { phone: adminPhone } = await requireAdmin();
  if (!/^TK-\d+$/i.test(ticketId)) return { success: false, error: 'Ticket ID invalido' };

  const supabase = createServerClient();

  // 1. Fetch venta
  const { data: venta, error: fetchErr } = await supabase
    .from('ventas')
    .select('id, ticket_id, nombre_completo, ci, telefono, cantidad, monto, numeros_asignados')
    .eq('ticket_id', ticketId)
    .maybeSingle();
  if (fetchErr) return { success: false, error: `Error buscando venta: ${fetchErr.message}` };
  if (!venta) return { success: false, error: 'No se encontro la venta' };

  const numeros = (venta.numeros_asignados as number[]) ?? [];

  // 2. Liberar rifas (primero, para minimizar ventana de inconsistencia)
  const { error: rifasErr } = await supabase
    .from('rifas')
    .update({ estado: 'LIBRE', venta_id: null, updated_at: new Date().toISOString(), reservado_hasta: null })
    .eq('venta_id', venta.id);
  if (rifasErr) return { success: false, error: `Error liberando rifas: ${rifasErr.message}` };

  // 3. Delete venta
  const { error: deleteErr } = await supabase.from('ventas').delete().eq('id', venta.id);
  if (deleteErr) {
    // Intentar restaurar rifas (rollback best-effort)
    await supabase
      .from('rifas')
      .update({ estado: 'VENDIDO', venta_id: venta.id })
      .in('numero', numeros);
    return { success: false, error: `Error eliminando venta: ${deleteErr.message}` };
  }

  // 4. Sheets row removal (fire-and-forget pero awaited para reportar status)
  let sheetsDeleted = false;
  try {
    sheetsDeleted = await deleteSaleFromSheets(ticketId);
  } catch (e) {
    console.error('deleteSaleFromSheets error:', e);
  }

  // 5. Telegram notify
  const numerosAsignadosStr = numeros
    .sort((a, b) => a - b)
    .map((n) => String(n).padStart(5, '0'))
    .join(', ');
  await notifyTelegramTicketDeleted({
    ticketId: venta.ticket_id,
    nombreCompleto: venta.nombre_completo || '',
    telefono: venta.telefono || '',
    ci: venta.ci || '',
    monto: venta.monto,
    cantidad: venta.cantidad,
    numerosAsignados: numerosAsignadosStr,
    deletedByPhone: adminPhone,
    sheetsDeleted,
  }).catch((e) => console.error('notify:', e));

  return { success: true, numerosLiberados: numeros.length, sheetsDeleted };
}
