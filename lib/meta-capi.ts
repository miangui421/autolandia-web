// lib/meta-capi.ts
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { getFbp, getFbc } from '@/lib/meta-cookies';

const GRAPH_API_URL = 'https://graph.facebook.com/v21.0';

export type MetaEventName = 'ViewContent' | 'InitiateCheckout' | 'Lead' | 'Purchase';

export interface MetaEventInput {
  eventName: MetaEventName;
  eventId: string;
  eventSourceUrl: string;
  phone?: string;
  nombreCompleto?: string;
  value?: number;
  currency?: 'PYG';
}

function hashForMeta(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function formatPhoneForMeta(phone: string): string {
  return phone.replace(/\D/g, '');
}

async function buildUserData(input: MetaEventInput) {
  const hdrs = await headers();
  const [fbp, fbc] = await Promise.all([getFbp(), getFbc()]);

  // x-forwarded-for puede venir como "client, proxy1, proxy2" — tomar el primero
  const xff = hdrs.get('x-forwarded-for') || '';
  const clientIp = xff.split(',')[0].trim() || hdrs.get('x-real-ip') || undefined;
  const userAgent = hdrs.get('user-agent') || undefined;

  const userData: Record<string, unknown> = {
    country: [hashForMeta('py')],
  };

  if (input.phone) {
    userData.ph = [hashForMeta(formatPhoneForMeta(input.phone))];
  }
  if (input.nombreCompleto) {
    userData.fn = [hashForMeta(input.nombreCompleto)];
  }
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;
  if (clientIp) userData.client_ip_address = clientIp;
  if (userAgent) userData.client_user_agent = userAgent;

  return userData;
}

/**
 * Envía un evento server-side a Meta Conversions API.
 * No-op silencioso si META_PIXEL_ID o META_CAPI_ACCESS_TOKEN no están seteados.
 * NO bloquea el flow del caller — envolver en Promise.allSettled si se llama
 * desde una server action.
 */
export async function sendMetaEvent(input: MetaEventInput): Promise<void> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const capiToken = process.env.META_CAPI_ACCESS_TOKEN;
  const testEventCode = process.env.META_TEST_EVENT_CODE;

  if (!pixelId || !capiToken) return;

  const userData = await buildUserData(input);

  const eventData: Record<string, unknown> = {
    event_name: input.eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: input.eventId,
    event_source_url: input.eventSourceUrl,
    action_source: 'website',
    user_data: userData,
  };

  if (input.value !== undefined) {
    eventData.custom_data = {
      value: input.value,
      currency: input.currency || 'PYG',
    };
  }

  const body: Record<string, unknown> = {
    data: [eventData],
    access_token: capiToken,
  };

  if (testEventCode) {
    body.test_event_code = testEventCode;
    console.log(`[meta-capi] sending ${input.eventName} with test_event_code=${testEventCode}`);
  }

  try {
    const response = await fetch(`${GRAPH_API_URL}/${pixelId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[meta-capi] ${input.eventName} HTTP ${response.status}: ${errorText}`);
      return;
    }

    const result = await response.json();
    if (result.events_received !== 1) {
      console.warn(`[meta-capi] ${input.eventName} unexpected response:`, result);
    }
  } catch (err) {
    console.error(`[meta-capi] ${input.eventName} network error:`, err);
  }
}
