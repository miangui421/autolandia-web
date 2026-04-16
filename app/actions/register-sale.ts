'use server';
import { registrarVentaRandom, registrarVentaManual } from '@/lib/sale-registrar';
import { notifyTelegramSale, appendSaleToSheets } from '@/lib/notifications';
import { createServerClient } from '@/lib/supabase-server';
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

  // Notifications — must await in serverless (lambda termina sin await)
  // Fecha en hora Paraguay (UTC-3) con formato "YYYY-MM-DD HH:mm:ss"
  const fecha = new Date().toLocaleString('sv-SE', {
    timeZone: 'America/Asuncion',
  });
  await Promise.allSettled([
    notifyTelegramSale({
      nombreCompleto: input.nombreCompleto,
      ci: input.ci,
      telefono: input.telefono,
      cantidad: input.cantidad,
      monto: String(input.monto),
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
      monto: String(input.monto),
      numerosAsignados: result.numerosAsignados,
      comprobanteUrl: input.comprobanteUrl,
      cantidad: input.cantidad,
      telefonoRegistro: input.telefono,
      transactionId: input.transactionId,
      mensajeInicial: 'WEB',
    }),
  ]);

  return result;
}
