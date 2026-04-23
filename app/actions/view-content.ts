'use server';

import { sendMetaEvent } from '@/lib/meta-capi';

/**
 * Dispara ViewContent CAPI desde el cliente fire-and-forget.
 * Client fire pixel inmediatamente con el mismo eventId → dedup.
 * No retorna valor (fire-and-forget).
 */
export async function viewContentServer(
  eventId: string,
  pathname: string,
): Promise<void> {
  const eventSourceUrl = `https://autolandia.com.py${pathname}`;
  await Promise.allSettled([
    sendMetaEvent({
      eventName: 'ViewContent',
      eventId,
      eventSourceUrl,
    }),
  ]);
}
