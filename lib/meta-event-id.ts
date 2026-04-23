// lib/meta-event-id.ts
/**
 * Genera un UUID v4 para dedup de eventos pixel + CAPI.
 * Se usa en el cliente para eventos VC/IC/Lead. Para Purchase, se reusa
 * `ventas.id` (también UUID) — este helper no se llama en ese caso.
 */
export function generateEventId(): string {
  if (typeof crypto === 'undefined' || !crypto.randomUUID) {
    throw new Error('crypto.randomUUID not available — check runtime');
  }
  return crypto.randomUUID();
}
