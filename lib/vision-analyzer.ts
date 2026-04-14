import OpenAI from 'openai';
import type { VisionResult } from '@/types';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

const FORENSIC_PROMPT = `Actúa como un Auditor Forense Financiero experto en validación de transferencias bancarias en Paraguay y Cupones de Sorteo Físicos.
Tu misión es clasificar el documento y extraer datos.
Analiza la imagen y devuelve ÚNICAMENTE un JSON con esta estructura exacta (sin texto extra, sin markdown):
{
  "tipo_documento": "TRANSFERENCIA" o "CUPON",
  "monto_detectado": 150000,
  "fecha_operacion": "YYYY-MM-DD",
  "banco_origen": "Nombre",
  "banco_destino": "Ueno bank",
  "titular_destino": "Nombre",
  "id_transaccion": "Texto",
  "analisis_fraude": {
      "es_sospechoso": false,
      "motivo_sospecha": null
  }
}
REGLAS GENERALES (OBLIGATORIAS):
- NO inventes datos. Si algo no se ve con claridad suficiente, devuelve null en ese campo.
- NO devuelvas jamás mensajes fuera del JSON (ej: "LP001 ya fue utilizado"). No tienes acceso a historial.
- DIFERENCIÁ "ID/Comprobante/Ref/Seq" vs "Nro de cuenta". Son cosas distintas.
- La cuenta destino 61921962 es un número válido y esperado como CUENTA, NO como id_transaccion.
  >>> Nunca invalides un comprobante por ver 61921962.
  >>> Nunca uses 61921962 como id_transaccion.

GUÍA PARA NO CONFUNDIR ID TRANSACCIÓN:
- id_transaccion (TRANSFERENCIA) SOLO puede provenir de campos etiquetados como:
  "Nº Comprobante", "Nro Comprobante", "Comprobante", "N° Operación", "Operación", "Transacción", "ID", "Ref", "Referencia", "Seq", "Secuencia", "Ticket", "Movimiento".
- Si el número aparece junto a etiquetas como:
  "Cuenta", "Nro. cuenta", "Cuenta destino", "Cuenta origen", "CBU", "IBAN", "Alias", "N° cuenta", "Cuenta a acreditar"
  >>> entonces ES CUENTA, NO id_transaccion.
- Si el único número visible es una cuenta (por ejemplo 61921962) y no hay "Comprobante/Ref/Seq", entonces id_transaccion = null.

REGLAS DE PRIORIDAD PARA CLASIFICAR (ORDEN ESTRICTO):

1) CASO CUPÓN (PRIORIDAD MÁXIMA, PERO CONSERVADORA ANTI-ALUCINACIÓN)
   Clasifica como "CUPON" SOLO si hay evidencia clara de cupón, cumpliendo AL MENOS UNA de estas condiciones:
   A) Ves explícitamente el texto "RIFA AUTOLANDIA" o "AUTOLANDIA" en contexto de rifa/boleta/cupón
      Y además hay un código con formato LP + dígitos (ej: LP001, LP050) visible como código independiente.
   B) Ves un código "LP" + 2–4 dígitos (LP001/LP050/etc) como texto aislado/etiquetado (ej: junto a "Código", "Cupón", "Boleta", "N°")
      y NO es parte de un número largo (como cuentas, teléfonos, referencias bancarias largas).
   Reglas anti-falso-positivo:
   - NO asumas que existe un LP si no lo ves.
   - NO conviertas fragmentos borrosos, letras parecidas (L/I/1/P/R) o números sueltos en "LP001".
   - Si ves "LP" pero SIN dígitos legibles o SIN contexto de rifa/autolandia, NO es suficiente: clasifica como TRANSFERENCIA.
   Si es CUPON:
   - "monto_detectado" = 0
   - "banco_origen" = "AUTOLANDIA"
   - "banco_destino" = "AUTOLANDIA"
   - "titular_destino" = "CUPON"
   - "id_transaccion" = el código LP leído (si no es legible, null)
   - "fecha_operacion": si no hay, asume el año actual si hay día/mes; si no hay fecha, null
   - "analisis_fraude": normalmente no aplica; usa es_sospechoso=false salvo manipulación evidente del cupón

2) CASO TRANSFERENCIA (solo si NO es cupón)
   Si parece App Bancaria / Ticket de pago / comprobante:
   - "tipo_documento" = "TRANSFERENCIA"
   - MONTO: extrae el valor principal en Gs. como entero (sin puntos/guiones). Si no es legible, null.
   - FECHA: formato "YYYY-MM-DD". Si falta el año, asume el actual. Si no es legible, null.
   - ID TRANSACCIÓN: busca en este orden de prioridad:
     1) "Nº Comprobante" / "Comprobante"
     2) "N° Operación" / "Operación"
     3) "Ref" / "Referencia"
     4) "Seq" / "Secuencia"
     Si no aparece con etiqueta clara, id_transaccion = null.
   - NUNCA uses como id_transaccion:
     * números de cuenta (incluye 61921962)
     * números de teléfono
     * CI/RUC
     * montos
     * fechas

TITULARES Y BANCOS (SECCIÓN CRÍTICA):
   >>> "titular_destino" = A QUIÉN LE LLEGA el dinero (el BENEFICIARIO/RECEPTOR)
   >>> "banco_origen" = DESDE DÓNDE se envía (el banco del REMITENTE/PAGADOR)
   >>> "banco_destino" = A DÓNDE llega (el banco del BENEFICIARIO)
   EL REMITENTE (quien paga) NO ES EL TITULAR DESTINO.

   REGLA ESPECÍFICA PARA COMPROBANTES DE UENO BANK / MANGO:
   - En estos comprobantes el layout típico es:
     * ARRIBA: Logo Ueno + nombre del beneficiario + número de cuenta
     * ABAJO: "Origen" + nombre de quien envía + su entidad financiera
   - El nombre de ARRIBA (junto a Ueno/cuenta) = titular_destino
   - El nombre de ABAJO (junto a "Origen") = remitente (NO es titular_destino)
   - Si la cuenta destino es 61921962 → titular_destino = "Oscar Santander"

   REGLA DE ORO:
   Si ves la cuenta 61921962 como destino, el titular_destino SIEMPRE es "Oscar Santander".

ANÁLISIS DE FRAUDE (solo para Transferencias):
   Señales: tipografía distinta, bordes/borrones/pegado digital, alineación chueca, inconsistencias.
   Si detectas algo fuerte: "es_sospechoso" = true, "motivo_sospecha" = explicación breve.

DOBLE VERIFICACIÓN (OBLIGATORIA ANTES DE RESPONDER):
   1. ¿Puse como titular_destino al REMITENTE? Si cuenta 61921962 → "Oscar Santander".
   2. ¿Usé 61921962 como id_transaccion? → ERROR. Es la cuenta.
   3. ¿Clasifiqué como CUPÓN sin ver "RIFA AUTOLANDIA" o código LP claro? → Cambiar a TRANSFERENCIA.
   4. ¿Inventé datos que no se ven? → Poner null.

Responde ÚNICAMENTE con el JSON. Sin explicaciones.`;

export async function analyzeReceipt(imageUrl: string): Promise<VisionResult> {
  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: FORENSIC_PROMPT },
          { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
        ],
      },
    ],
    max_tokens: 1000,
    temperature: 0,
  });

  const rawText = response.choices[0]?.message?.content ?? '{}';
  const data = parseAIResponse(rawText);

  return {
    tipoDocumento: data.tipo_documento || 'TRANSFERENCIA',
    montoDetectado: parseInt(String(data.monto_detectado || 0).replace(/\D/g, '')) || 0,
    fechaOperacion: data.fecha_operacion || null,
    bancoOrigen: data.banco_origen || 'DESCONOCIDO',
    bancoDestino: data.banco_destino || 'DESCONOCIDO',
    titularDestino: data.titular_destino || 'DESCONOCIDO',
    idTransaccion: data.id_transaccion || 'NO_DETECTADO',
    analisisFraude: {
      esSospechoso: data.analisis_fraude?.es_sospechoso === true,
      motivoSospecha: data.analisis_fraude?.motivo_sospecha || null,
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseAIResponse(rawText: string): Record<string, any> {
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) return {};

  const cleanText = rawText.substring(firstBrace, lastBrace + 1);
  try {
    const sanitized = cleanText.replace(/[\u0000-\u001F]+/g, '').replace(/\\n/g, '\\n').replace(/\\'/g, "'");
    return JSON.parse(sanitized);
  } catch {
    return {};
  }
}
