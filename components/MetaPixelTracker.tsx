'use client';

import { useEffect, useRef } from 'react';
import { generateEventId } from '@/lib/meta-event-id';
import { trackViewContent } from '@/lib/pixel';
import { viewContentServer } from '@/app/actions/view-content';

export function MetaPixelTracker({ pathname }: { pathname: string }) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    const eventId = generateEventId();
    trackViewContent({ eventId });
    viewContentServer(eventId, pathname).catch(console.error);
  }, [pathname]);

  return null;
}
