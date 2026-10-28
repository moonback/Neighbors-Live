'use client';

import Link from 'next/link';
import { useFormatter, useTranslations, useNow } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Button, Notice } from '@/components/ui';
import { useErrorText } from '@/components/useErrorText';
import { api } from '@/lib/client-api';

interface OwnVideo {
  id: string;
  category: string;
  caption: string;
  status: 'processing' | 'active' | 'hidden' | 'removed' | 'expired' | 'rejected';
  created_at: string;
}

const statusColor: Record<OwnVideo['status'], string> = {
  processing: 'bg-sky-500',
  active: 'bg-green-500',
  hidden: 'bg-amber-500',
  removed: 'bg-alert',
  expired: 'bg-line',
  rejected: 'bg-alert',
};

async function fetchOwnVideos(): Promise<{ videos: OwnVideo[] } | { error: string }> {
  const res = await api<{ videos: OwnVideo[] }>('/api/me/videos');
  return res.ok ? { videos: res.data.videos } : { error: res.error };
}

/** Owner view: status of every publication (processing → active / rejected) and withdrawal. */
export function MyVideos() {
  const t = useTranslations('profile');
  const tc = useTranslations('common.categories');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const errorText = useErrorText();
  const [videos, setVideos] = useState<OwnVideo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    const result = await fetchOwnVideos();
    if ('error' in result) setLoadError(errorText(result.error));
    else {
      setVideos(result.videos);
      setLoadError(null);
    }
  }, [errorText]);

  useEffect(() => {
    let alive = true;
    void fetchOwnVideos().then((result) => {
      if (!alive) return;
      if ('error' in result) setLoadError(errorText(result.error));
      else setVideos(result.videos);
    });
    return () => {
      alive = false;
    };
  }, [errorText]);

  // Poll while something is processing so the status flips to active/rejected without reload.
  useEffect(() => {
    if (!videos?.some((v) => v.status === 'processing')) return;
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [videos, load]);

  async function withdraw(id: string) {
    if (!window.confirm(t('withdrawConfirm'))) return;
    const res = await api(`/api/videos/${id}`, { method: 'DELETE', body: {} });
    setMessage(
      res.ok
        ? { kind: 'success', text: t('withdrawn') }
        : { kind: 'error', text: errorText(res.error) ?? '' },
    );
    if (res.ok) void load();
  }

  if (loadError) return <Notice kind="error">{loadError}</Notice>;
  if (!videos) return <p role="status" className="text-sm text-fog">{t('collectionLoading')}</p>;
  return (
    <section aria-labelledby="my-videos" className="flex flex-col gap-3">
      <div>
        <h2 id="my-videos" className="text-lg font-semibold">
          {t('myVideos')}
        </h2>
        <p className="mt-1 text-sm text-fog">{t('myVideosDescription')}</p>
      </div>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      {videos.length === 0 && (
        <div className="rounded-2xl border border-line bg-panel p-4 text-sm text-fog">
          <p>{t('emptyMyVideos')}</p>
        </div>
      )}
      <ul className="flex flex-col gap-2" aria-live="polite">
        {videos.map((v) => (
          <li
            key={v.id}
            className="flex items-center gap-3 rounded-xl border border-line bg-panel p-3"
            data-testid="own-video"
            data-status={v.status}
          >
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusColor[v.status]}`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                <strong>{tc(v.category)}</strong> · {v.caption || '—'}
              </p>
              <p className="text-xs text-fog">
                {t(`status.${v.status}`)} · {format.relativeTime(new Date(v.created_at), now)}
              </p>
              {v.status === 'hidden' || v.status === 'removed' || v.status === 'rejected' ? (
                <Link
                  href="/me/decisions"
                  className="mt-1 inline-flex min-h-11 items-center text-xs font-semibold underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {t('viewModerationDecision')}
                </Link>
              ) : null}
            </div>
            {v.status !== 'removed' && (
              <Button variant="ghost" className="text-sm" onClick={() => withdraw(v.id)}>
                {t('withdraw')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
