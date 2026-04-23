'use server';
import { registrarVentaRandom, registrarVentaManual } from '@/lib/sale-registrar';
import { notifyTelegramSale, appendSaleToSheets } from '@/lib/notifications';
import { createServerClient } from '@/lib/supabase-server';
import { sendMetaEvent } from '@/lib/meta-capi';
import type { SaleResult } from '@/types';

interface RegisterSaleInput {
  cantidad: number;
  transactionId: string;
  nombreCompleto: string;
  ci: string;
  telefono: string;
  monto: number;
  comprobanteUrl: string;
  metodoPago: string;
  selectedNumbers: number[];
  isPromo3x1?: boolean;
}

export async function registerSale(input: RegisterSaleInput): Promise<SaleResult> {
  const saleInput = {
    cantidad: input.cantidad,
    transactionId: input.transactionId,
    nombreCompleto: input.nombreCompleto,
    ci: input.ci,
    telefono: input.telefono,
    monto: input.monto,
    comprobanteUrl: input.comprobanteUrl,
    metodoPago: input.metodoPago,
    telefonoRegistro: input.telefono,
    mensajeInicial: '', // La web no tiene "mensaje inicial" (campo del bot). Canal WEB va en col M
    isPromo3x1: input.isPromo3x1 === true,
  };

  const result =
    input.selectedNumbers.length > 0
      ? await registrarVentaManual(saleInput, input.selectedNumbers)
      : await registrarVentaRandom(saleInput);

  // Lead upsert
  const supabase = createServerClient();
  await supabase.from('leads').upsert(
    {
      phone: input.telefono,
      stage: 'COMPRADOR',
      last_contact_at: new Date().toISOString(),
    },
    { onConflict: 'phone' },
  );

  // Fetch venta.id (UUID) + monto desde la DB via ticket_id.
  // El RPC registrar_venta_web solo retorna { ticket_id, numeros_asignados },
  // así que necesitamos una query para obtener el UUID que usamos como eventId en Meta CAPI.
  // Aprovechamos la misma query para el guard de monto (si viene invalido).
  const { data: ventaRow } = await supabase
    .from('ventas')
    .select('id, monto')
    .eq('ticket_id', result.ticketId)
    .maybeSingle();

  const ventaId: string | undefined = ventaRow?.id;

  let montoFinal = Number(input.monto);
  if (!Number.isFinite(montoFinal) || montoFinal <= 0) {
    console.error(
      `[registerSale] monto invalido para ${result.ticketId}: "${input.monto}" (${typeof input.monto}). Recuperando de DB.`,
    );
    montoFinal = Number(ventaRow?.monto ?? 0);
  }

  // Notifications — must await in serverless (lambda termina sin await)
  const fecha = new Date().toLocaleString('sv-SE', { timeZone: 'America/Asuncion' });
  await Promise.allSettled([
    notifyTelegramSale({
      nombreCompleto: input.nombreCompleto,
      ci: input.ci,
      telefono: input.telefono,
      cantidad: input.cantidad,
      monto: String(montoFinal),
      ticketId: result.ticketId,
      numerosAsignados: result.numerosAsignados,
      comprobanteUrl: input.comprobanteUrl,
    }),
    appendSaleToSheets({
      telefono: input.telefono,
      fecha,
      ticketId: result.ticketId,
      nombreCompleto: input.nombreCompleto,
      ci: input.ci,
      monto: String(montoFinal),
      numerosAsignados: result.numerosAsignados,
      comprobanteUrl: input.comprobanteUrl,
      cantidad: input.cantidad,
      telefonoRegistro: input.telefono,
      transactionId: input.transactionId,
      mensajeInicial: 'WEB',
    }),
  ]);

  // CAPI Purchase (fire-and-forget). Usa ventas.id (UUID) como eventId para dedup
  // con el pixel client-side. Solo dispara si pudimos resolver el UUID.
  if (ventaId) {
    await Promise.allSettled([
      sendMetaEvent({
        eventName: 'Purchase',
        eventId: ventaId,
        eventSourceUrl: 'https://autolandia.com.py/checkout',
        phone: input.telefono,
        nombreCompleto: input.nombreCompleto,
        value: montoFinal,
        currency: 'PYG',
      }),
    ]);
  }

  return {
    ...result,
    event_id: ventaId,
  };
}
