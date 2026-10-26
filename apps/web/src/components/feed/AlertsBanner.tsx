'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client-api';
import type { FeedItem } from '@/lib/feed';

interface LiveAlert {
  id: string;
  caption: string;
  lat: number;
  lng: number;
}

/**
 * "Alertes proches" banner: initial list from the feed API, then live updates over Supabase
 * Realtime broadcast topics (one per H3 res-7 cell covering the radius). Payloads only carry
 * fuzzed positions.
 */
export function AlertsBanner({
  lat,
  lng,
  radius,
  onShow,
}: {
  lat: number;
  lng: number;
  radius: number;
  onShow: () => void;
}) {
  const t = useTranslations('feed.alerts');
  const [alerts, setAlerts] = useState<Map<string, string>>(new Map());
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const qs = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      radius: String(radius),
      category: 'alert',
      limit: '20',
    });
    void api<{ items: FeedItem[] }>(`/api/feed?${qs}`).then((res) => {
      if (alive && res.ok) setAlerts(new Map(res.data.items.map((i) => [i.id, i.caption])));
    });

    // Realtime client and H3 are loaded after first paint, only where the banner is used.
    let cleanup = () => {};
    void Promise.all([import('@nl/shared'), import('@/lib/supabase/browser')]).then(
      ([{ haversineMeters, realtimeCells }, { browserClient }]) => {
        if (!alive) return;
        const supabase = browserClient();
        // shortcut: live updates cover at most 5 km (61 channels; 10 km would need 127, over
        // Realtime's per-client channel limit). Upgrade with coarser topic cells if needed.
        const channels = realtimeCells({ lat, lng }, Math.min(radius, 5000)).map((cell) =>
          supabase
            .channel(`alerts:${cell}`, { config: { private: false } })
            .on('broadcast', { event: 'alert' }, ({ payload }) => {
              const a = payload as LiveAlert;
              if (haversineMeters({ lat, lng }, a) > radius + 50) return;
              setAlerts((prev) => new Map(prev).set(a.id, a.caption));
              setFlash(a.caption || '');
              setTimeout(() => setFlash(null), 6000);
            })
            .subscribe(),
        );
        cleanup = () => {
          for (const c of channels) void supabase.removeChannel(c);
        };
      },
    );
    return () => {
      alive = false;
      cleanup();
    };
  }, [lat, lng, radius]);

  if (alerts.size === 0) return null;
  return (
    <div className="min-w-0 flex-1">
      <button
        type="button"
        onClick={onShow}
        className="flex min-h-10 w-full items-center gap-2 overflow-hidden rounded-full bg-rose-600 px-3 text-left text-xs font-bold text-white shadow-lg shadow-rose-950/20 transition hover:bg-rose-700 focus-visible:outline-white sm:text-sm"
        aria-label={`${t('banner', { count: alerts.size })} — ${t('show')}`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        >
          <path d="M12 3 2.8 20h18.4L12 3Z" />
          <path d="M12 9v4m0 3h.01" />
        </svg>
        <span className="truncate">{t('banner', { count: alerts.size })}</span>
      </button>
      {flash !== null && (
        <p
          role="alert"
          className="absolute left-4 right-4 top-full mt-2 rounded-xl bg-slate-950/90 px-3 py-2 text-sm text-white shadow-lg backdrop-blur"
        >
          {t('new', { caption: flash })}
        </p>
      )}
    </div>
  );
}
