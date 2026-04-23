// lib/pixel.ts
// Client-only helpers para disparar eventos al Meta Pixel.
// Todos los helpers son no-op silenciosos si fbq no está disponible
// (pixel bloqueado por adblock, todavía no cargado, SSR, etc.).

type FbqFn = (
  command: 'track' | 'init',
  eventName: string,
  params?: Record<string, unknown>,
  options?: { eventID?: string },
) => void;

declare global {
  interface Window {
    fbq?: FbqFn;
  }
}

function fire(
  eventName: string,
  params: Record<string, unknown>,
  eventId: string,
): void {
  if (typeof window === 'undefined' || !window.fbq) return;
  window.fbq('track', eventName, params, { eventID: eventId });
}

export function trackViewContent(opts: { eventId: string }): void {
  fire('ViewContent', {}, opts.eventId);
}

export function trackInitiateCheckout(opts: {
  eventId: string;
  value: number;
  currency?: 'PYG';
}): void {
  fire(
    'InitiateCheckout',
    { value: opts.value, currency: opts.currency || 'PYG' },
    opts.eventId,
  );
}

export function trackLead(opts: { eventId: string }): void {
  fire('Lead', {}, opts.eventId);
}

export function trackPurchase(opts: {
  eventId: string;
  value: number;
  currency?: 'PYG';
}): void {
  fire(
    'Purchase',
    { value: opts.value, currency: opts.currency || 'PYG' },
    opts.eventId,
  );
}
