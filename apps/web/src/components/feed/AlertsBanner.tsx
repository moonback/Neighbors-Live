'use client';

import { haversineMeters, realtimeCells } from '@nl/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client-api';
import type { FeedItem } from '@/lib/feed';
import { browserClient } from '@/lib/supabase/browser';

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

    const supabase = browserClient();
    const channels = realtimeCells({ lat, lng }, radius).map((cell) =>
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
    return () => {
      alive = false;
      for (const c of channels) void supabase.removeChannel(c);
    };
  }, [lat, lng, radius]);

  if (alerts.size === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onShow}
        className="flex min-h-11 items-center gap-2 rounded-xl bg-alert px-3 py-2 text-left text-sm font-semibold text-ink"
        aria-label={`${t('banner', { count: alerts.size })} — ${t('show')}`}
      >
        <span aria-hidden="true">⚠</span>
        {t('banner', { count: alerts.size })}
      </button>
      {flash !== null && (
        <p role="alert" className="rounded-xl bg-black/80 px-3 py-2 text-sm">
          {t('new', { caption: flash })}
        </p>
      )}
    </div>
  );
}
