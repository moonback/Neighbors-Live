'use client';

import type { VideoEventKind } from '@nl/shared';
import { useEffect, type AnchorHTMLAttributes } from 'react';
import { trackVideoEvent } from '@/lib/video-events';

/** Counts an offer page view after 2 s on screen, like the feed. */
export function TrackOfferView({ videoId }: { videoId: string }) {
  useEffect(() => {
    const timer = setTimeout(() => trackVideoEvent(videoId, 'view'), 2000);
    return () => clearTimeout(timer);
  }, [videoId]);
  return null;
}

/** Offer action link that records an aggregated click before following it. */
export function TrackedOfferLink({
  videoId,
  kind,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { videoId: string; kind: VideoEventKind }) {
  return <a {...props} onClick={() => trackVideoEvent(videoId, kind)} />;
}
