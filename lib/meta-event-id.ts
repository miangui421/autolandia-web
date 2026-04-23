// lib/meta-event-id.ts
/**
 * Genera un UUID v4 para dedup de eventos pixel + CAPI.
 * Se usa en el cliente para eventos VC/IC/Lead. Para Purchase, se reusa
 * `ventas.id` (también UUID) — este helper no se llama en ese caso.
 *
 * Fallback para browsers sin crypto.randomUUID (iOS Safari <15.4):
 * genera un v4 con Math.random. No es criptográficamente seguro pero
 * para dedup de eventos de tracking (no secretos) es suficiente.
 */
export function generateEventId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
