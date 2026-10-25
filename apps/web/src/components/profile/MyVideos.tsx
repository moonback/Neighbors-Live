'use client';

import { useFormatter, useTranslations } from 'next-intl';
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

async function fetchOwnVideos(): Promise<OwnVideo[] | null> {
  const res = await api<{ videos: OwnVideo[] }>('/api/me/videos');
  return res.ok ? res.data.videos : null;
}

/** Owner view: status of every publication (processing → active / rejected) and withdrawal. */
export function MyVideos() {
  const t = useTranslations('profile');
  const tc = useTranslations('common.categories');
  const format = useFormatter();
  const errorText = useErrorText();
  const [videos, setVideos] = useState<OwnVideo[] | null>(null);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(() => fetchOwnVideos().then((list) => list && setVideos(list)), []);

  useEffect(() => {
    let alive = true;
    void fetchOwnVideos().then((list) => alive && list && setVideos(list));
    return () => {
      alive = false;
    };
  }, []);

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

  if (!videos || videos.length === 0) return null;
  return (
    <section aria-labelledby="my-videos" className="flex flex-col gap-3">
      <h2 id="my-videos" className="text-lg font-semibold">
        {t('myVideos')}
      </h2>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
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
                {t(`status.${v.status}`)} · {format.relativeTime(new Date(v.created_at))}
              </p>
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
