'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { judge, listQueued, removeQueued } from '@/lib/offline-queue';
import { currentPosition } from '@/lib/platform';
import { publish, PublishError } from '@/lib/publish';

/**
 * Republishes recordings kept offline once the network is back, but only if the device is
 * still within 100 m of where they were filmed (and with a precise fix).
 */
export function OfflineQueueRunner() {
  const t = useTranslations('capture.offline');
  const [pending, setPending] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const running = useRef(false);

  const drain = useCallback(async () => {
    if (running.current || !navigator.onLine) return;
    running.current = true;
    try {
      const items = await listQueued();
      setPending(items.length);
      if (items.length === 0) return;
      let fix;
      try {
        const pos = await currentPosition();
        fix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        };
      } catch {
        return;
      }
      for (const item of items) {
        const verdict = judge(item, Date.now(), fix);
        if (verdict === 'wait-precision') continue;
        if (verdict !== 'publish') {
          await removeQueued(item.id);
          setMessage(t('dropped'));
          continue;
        }
        try {
          await publish(item.blob, item.meta, item.fix, () => undefined);
          await removeQueued(item.id);
          setMessage(t('sent'));
        } catch (error) {
          if (!(error instanceof PublishError && error.retryable)) await removeQueued(item.id);
        }
      }
      setPending((await listQueued()).length);
    } finally {
      running.current = false;
    }
  }, [t]);

  useEffect(() => {
    const onOnline = () => void drain();
    window.addEventListener('online', onOnline);
    const timer = setTimeout(onOnline, 3000);
    return () => {
      window.removeEventListener('online', onOnline);
      clearTimeout(timer);
    };
  }, [drain]);

  if (!pending && !message) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-3 top-3 z-40 rounded-xl border border-line bg-panel/95 px-3 py-2 text-sm shadow-lg"
    >
      {message ?? t('pending', { count: pending })}
    </div>
  );
}
