import { createServerClient } from './supabase-server';

export interface RegisterSaleInput {
  cantidad: number;
  transactionId: string;
  nombreCompleto: string;
  ci: string;
  telefono: string;
  monto: number;
  comprobanteUrl: string;
  metodoPago: string;
  telefonoRegistro: string;
  mensajeInicial: string;
  isPromo3x1?: boolean;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface RegisterSaleResult {
  ticketId: string;
  numerosAsignados: string;
}

/**
 * Registra una venta con query CTE atómica — asignación aleatoria.
 */
export async function registrarVentaRandom(input: RegisterSaleInput): Promise<RegisterSaleResult> {
  const supabase = createServerClient();

  const { data, error } = await supabase.rpc('registrar_venta_web', {
    p_cantidad: input.cantidad,
    p_transaction_id: input.transactionId,
    p_nombre_completo: input.nombreCompleto,
    p_ci: input.ci,
    p_telefono: input.telefono,
    p_monto: input.monto,
    p_comprobante_url: input.comprobanteUrl,
    p_metodo_pago: input.metodoPago,
    p_telefono_registro: input.telefonoRegistro,
    p_mensaje_inicial: input.mensajeInicial,
    p_numeros_especificos: null,
    p_is_promo_3x1: input.isPromo3x1 === true,
    p_utm_source: input.utmSource ?? null,
    p_utm_medium: input.utmMedium ?? null,
    p_utm_campaign: input.utmCampaign ?? null,
  });

  if (error) throw new Error(`Error registrando venta: ${error.message}`);

  return {
    ticketId: data?.ticket_id || 'TK-ERROR',
    numerosAsignados: data?.numeros_asignados || '',
  };
}

/**
 * Registra una venta con números específicos (selección manual).
 */
export async function registrarVentaManual(
  input: RegisterSaleInput,
  numbers: number[],
): Promise<RegisterSaleResult> {
  const supabase = createServerClient();

  const { data, error } = await supabase.rpc('registrar_venta_web', {
    p_cantidad: input.cantidad,
    p_transaction_id: input.transactionId,
    p_nombre_completo: input.nombreCompleto,
    p_ci: input.ci,
    p_telefono: input.telefono,
    p_monto: input.monto,
    p_comprobante_url: input.comprobanteUrl,
    p_metodo_pago: input.metodoPago,
    p_telefono_registro: input.telefonoRegistro,
    p_mensaje_inicial: input.mensajeInicial,
    p_numeros_especificos: numbers,
    p_is_promo_3x1: input.isPromo3x1 === true,
    p_utm_source: input.utmSource ?? null,
    p_utm_medium: input.utmMedium ?? null,
    p_utm_campaign: input.utmCampaign ?? null,
  });

  if (error) throw new Error(`Error registrando venta: ${error.message}`);

  return {
    ticketId: data?.ticket_id || 'TK-ERROR',
    numerosAsignados: data?.numeros_asignados || '',
  };
}
