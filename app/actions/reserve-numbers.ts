'use server';
import { createServerClient } from '@/lib/supabase-server';
import { sendMetaEvent } from '@/lib/meta-capi';

export async function reserveNumbers(
  numbers: number[],
  meta?: { eventId: string; phone: string; value: number },
): Promise<{ success: boolean; failed: number[] }> {
  const supabase = createServerClient();
  const failed: number[] = [];
  const reserveUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  for (const num of numbers) {
    const { data, error } = await supabase
      .from('rifas')
      .update({ reservado_hasta: reserveUntil })
      .eq('numero', num)
      .eq('estado', 'LIBRE')
      .or(`reservado_hasta.is.null,reservado_hasta.lt.${new Date().toISOString()}`)
      .select('numero');

    if (error || !data || data.length === 0) failed.push(num);
  }

  if (meta && failed.length === 0) {
    await Promise.allSettled([
      sendMetaEvent({
        eventName: 'InitiateCheckout',
        eventId: meta.eventId,
        eventSourceUrl: 'https://autolandia.com.py/checkout',
        phone: meta.phone,
        value: meta.value,
        currency: 'PYG',
      }),
    ]);
  }

  return { success: failed.length === 0, failed };
}

export async function releaseNumbers(numbers: number[]): Promise<void> {
  const supabase = createServerClient();
  await supabase.from('rifas').update({ reservado_hasta: null }).in('numero', numbers).eq('estado', 'LIBRE');
}
