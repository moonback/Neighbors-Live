import type { VideoEventKind } from '@nl/shared';

function firstViewInTab(videoId: string): boolean {
  try {
    const key = `nl:viewed:${videoId}`;
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, '1');
  } catch {
    // Storage blocked: count the view anyway, the server rate limit still caps it.
  }
  return true;
}

/**
 * Fire-and-forget statistics event; never throws, never blocks the UI.
 * shortcut: views are deduplicated client-side only, a hostile client can inflate them up to the
 * server rate limit; move deduplication server-side if merchants contest the numbers.
 */
export function trackVideoEvent(videoId: string, kind: VideoEventKind): void {
  if (kind === 'view' && !firstViewInTab(videoId)) return;
  try {
    void fetch(`/api/videos/${videoId}/events`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // fetch unavailable: statistics are best effort.
  }
}
