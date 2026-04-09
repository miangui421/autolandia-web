import { createServerClient } from './supabase-server';
import { TITULARES_VALIDOS, FECHA_MINIMA_COMPROBANTE } from './constants';
import type { VisionResult, FraudCheckResult } from '@/types';

function normalize(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

export async function validatePaymentSecurity(
  visionResult: VisionResult,
  montoEsperado: number,
): Promise<FraudCheckResult> {
  let tipoDoc = visionResult.tipoDocumento;
  const idTransaccion = visionResult.idTransaccion;

  if (typeof idTransaccion === 'string' && idTransaccion.toUpperCase().startsWith('LP')) {
    tipoDoc = 'CUPON';
  }

  const montoDetectado = visionResult.montoDetectado;

  // 1. Duplicate check
  let esDuplicado = false;
  if (idTransaccion && idTransaccion !== 'NO_DETECTADO') {
    const supabase = createServerClient();
    const { data } = await supabase
      .from('ventas')
      .select('transaction_id')
      .eq('transaction_id', idTransaccion)
      .limit(1);

    if (data && data.length > 0) esDuplicado = true;
  }

  // 2. Titular validation (transfers only)
  const titular = visionResult.titularDestino;
  const titularOK = TITULARES_VALIDOS.some((t) => normalize(titular).includes(t));

  // 3. AI fraud detection
  const sospechaFraudeIA = visionResult.analisisFraude.esSospechoso;
  const motivoFraudeIA = visionResult.analisisFraude.motivoSospecha || 'Inconsistencia visual.';

  // 4. Final evaluation
  let status: 'approved' | 'rejected' = 'approved';
  let motivo: string | null = null;
  let metodoPago: 'TRANSFERENCIA' | 'CUPON' = 'TRANSFERENCIA';

  if (tipoDoc === 'CUPON') {
    metodoPago = 'CUPON';
    if (idTransaccion === 'NO_DETECTADO' || !idTransaccion) {
      status = 'rejected';
      motivo = 'El cupon no tiene un codigo visible o valido.';
    }
  } else {
    if (montoDetectado <= 0) {
      status = 'rejected';
      motivo = 'No leimos el monto. Subi una foto clara.';
    } else if (montoEsperado > 0 && montoDetectado < montoEsperado * 0.95) {
      status = 'rejected';
      motivo = `Monto insuficiente: ${montoDetectado.toLocaleString()} vs ${montoEsperado.toLocaleString()}.`;
    } else if (!titularOK) {
      status = 'rejected';
      motivo = `Titular incorrecto: ${titular}`;
    }
  }

  if (esDuplicado) {
    status = 'rejected';
    motivo = `DUPLICADO: El comprobante/cupon (${idTransaccion}) ya fue usado.`;
  } else if (sospechaFraudeIA) {
    status = 'rejected';
    motivo = `SEGURIDAD: Imagen sospechosa. (${motivoFraudeIA})`;
  }

  if (status === 'approved' && visionResult.fechaOperacion) {
    if (visionResult.fechaOperacion < FECHA_MINIMA_COMPROBANTE) {
      status = 'rejected';
      motivo = `Comprobante con fecha ${visionResult.fechaOperacion} — anterior al inicio del sorteo.`;
    }
  }

  return { status, motivoRechazo: motivo, montoDetectado, idTransaccion, metodoPago };
}
