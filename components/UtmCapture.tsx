'use client';

import { useEffect } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import {
  UTM_COOKIE_NAME,
  UTM_COOKIE_MAX_AGE_SECONDS,
  parseUtmCookie,
  serializeUtmCookie,
  extractUtmsFromSearchParams,
  type UtmData,
} from '@/lib/utm-tracking';

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : undefined;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${value}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${secure}`;
}

function pushClarityTags(utm: UtmData): void {
  if (typeof window === 'undefined' || !window.clarity) return;
  window.clarity('set', 'utm_source', utm.source ?? 'direct');
  window.clarity('set', 'utm_campaign', utm.campaign ?? '-');
  window.clarity('set', 'canal', 'web');
}

export function UtmCapture() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    const existing = parseUtmCookie(readCookie(UTM_COOKIE_NAME));
    if (existing) {
      pushClarityTags(existing);
      return;
    }

    const params = new URLSearchParams(searchParams?.toString() ?? '');
    const incoming = extractUtmsFromSearchParams(params);
    if (!incoming) return;

    const payload: UtmData = {
      ...incoming,
      landing_page: pathname ?? '/',
      first_visit_at: new Date().toISOString(),
    };

    try {
      writeCookie(UTM_COOKIE_NAME, serializeUtmCookie(payload), UTM_COOKIE_MAX_AGE_SECONDS);
      pushClarityTags(payload);
    } catch (err) {
      console.error('[UtmCapture] error writing cookie:', err);
    }
  }, [searchParams, pathname]);

  return null;
}
