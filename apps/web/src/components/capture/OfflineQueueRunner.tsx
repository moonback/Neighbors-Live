'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { currentPosition } from '@/lib/platform';

/**
 * Republishes recordings kept offline once the network is back, but only if the device is
 * still within 100 m of where they were filmed (and with a precise fix).
 */
export function OfflineQueueRunner() {
  const t = useTranslations('capture.offline');
  const [pending, setPending] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const running = useRef(false);

  const drain = useCallback(async () => {
    if (running.current || !navigator.onLine) return;
    running.current = true;
    setMessage(null);
    setCanRetry(false);
    try {
      // Loaded lazily: this runner is mounted on every page but rarely has work.
      const { judge, listQueued, removeQueued } = await import('@/lib/offline-queue');
      const items = await listQueued();
      setPending(items.length);
      if (items.length === 0) return;
      const { publish, PublishError } = await import('@/lib/publish');
      let fix;
      try {
        const pos = await currentPosition();
        fix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        };
      } catch {
        setMessage(t('locationUnavailable'));
        setCanRetry(true);
        return;
      }
      for (const item of items) {
        const verdict = judge(item, Date.now(), fix);
        if (verdict === 'wait-precision') {
          setMessage(t('waitPrecision'));
          setCanRetry(true);
          continue;
        }
        if (verdict !== 'publish') {
          await removeQueued(item.id);
          setMessage(t(verdict === 'drop-stale' ? 'droppedStale' : 'droppedMoved'));
          continue;
        }
        try {
          await publish(item.blob, item.meta, item.fix, () => undefined);
          await removeQueued(item.id);
          setMessage(t('sent'));
        } catch (error) {
          if (error instanceof PublishError && error.retryable) {
            setMessage(t('retryable'));
            setCanRetry(true);
          } else {
            await removeQueued(item.id);
            setMessage(t('failed'));
          }
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
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <span>{message ?? t('pending', { count: pending })}</span>
        {canRetry && (
          <button
            type="button"
            onClick={() => void drain()}
            className="min-h-11 shrink-0 rounded-lg px-3 font-semibold text-accent underline underline-offset-4"
          >
            {t('retry')}
          </button>
        )}
      </div>
    </div>
  );
}
