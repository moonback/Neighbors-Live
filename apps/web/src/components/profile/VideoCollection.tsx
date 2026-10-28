'use client';

import Link from 'next/link';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { api } from '@/lib/client-api';

type CollectionKind = 'saved' | 'hidden';
type CollectionVideo = {
  id: string;
  savedAt: number;
  category: string | null;
  caption: string | null;
  authorName: string | null;
  posterUrl: string | null;
  status: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
};

const ENDPOINTS: Record<CollectionKind, string> = {
  saved: '/api/me/saved-videos',
  hidden: '/api/me/hidden-videos',
};

export function VideoCollection({ kind }: { kind: CollectionKind }) {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const [videos, setVideos] = useState<CollectionVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    setActionError(false);
    const result = await api<{ videos: CollectionVideo[] }>(ENDPOINTS[kind]);
    if (result.ok) setVideos(result.data.videos);
    else setError(true);
    setLoading(false);
  }, [kind]);

  useEffect(() => {
    let active = true;
    void api<{ videos: CollectionVideo[] }>(ENDPOINTS[kind]).then((result) => {
      if (!active) return;
      if (result.ok) setVideos(result.data.videos);
      else setError(true);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [kind]);

  async function removeVideo(videoId: string) {
    setPendingId(videoId);
    setActionError(false);
    const result = await api<{ ids: string[] }>(ENDPOINTS[kind], {
      method: 'DELETE',
      body: { videoId },
    });
    if (result.ok) {
      setVideos((current) => current.filter((video) => video.id !== videoId));
      window.dispatchEvent(new Event('nl-saved-videos-change'));
      window.dispatchEvent(new Event('nl-hidden-videos-change'));
    } else {
      setActionError(true);
    }
    setPendingId(null);
  }

  const title = kind === 'saved' ? t('savedVideos') : t('hiddenVideos');
  const emptyText = kind === 'saved' ? t('emptySavedVideos') : t('emptyHiddenVideos');
  const actionText = kind === 'saved' ? t('removeSaved') : t('restoreHidden');
  const dateKey = kind === 'saved' ? 'savedOn' : 'hiddenOn';

  return (
    <section aria-labelledby={`${kind}-videos-heading`} className="flex flex-col gap-3">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id={`${kind}-videos-heading`} className="text-lg font-semibold">
            {title}
          </h2>
          <p className="text-sm text-fog">{t('collectionDescription')}</p>
        </div>
        {!loading && !error && (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-fog">
            {t('collectionCount', { count: videos.length })}
          </span>
        )}
      </header>

      {loading ? (
        <p
          role="status"
          className="rounded-2xl border border-white/10 bg-panel p-4 text-sm text-fog"
        >
          {t('collectionLoading')}
        </p>
      ) : error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-400/30 bg-red-950/20 p-4">
          <p role="alert" className="text-sm text-white">
            {t('collectionError')}
          </p>
          <Button variant="secondary" onClick={() => void refresh()}>
            {t('retryCollection')}
          </Button>
        </div>
      ) : (
        <>
          {actionError && (
            <p
              role="alert"
              className="rounded-xl border border-red-400/30 bg-red-950/20 p-3 text-sm text-white"
            >
              {t('collectionActionError')}
            </p>
          )}
          {videos.length === 0 ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-panel p-4 text-sm text-fog sm:flex-row sm:items-center sm:justify-between">
              <p>{emptyText}</p>
              <Link
                href="/"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 font-semibold text-ink transition-colors hover:bg-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {t('browseFeed')}
              </Link>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {videos.map((video) => {
                const available =
                  video.status === 'active' &&
                  (!video.expiresAt || new Date(video.expiresAt).getTime() > now.getTime());
                const categoryLabel = video.category
                  ? tc(`categories.${video.category}`)
                  : t('unknownCategory');
                const date = format.relativeTime(new Date(video.savedAt), now);
                const unavailableLabel =
                  video.status === 'hidden'
                    ? t('videoModerated')
                    : video.status === 'expired' ||
                        (video.expiresAt !== null &&
                          new Date(video.expiresAt).getTime() <= now.getTime())
                      ? t('videoExpired')
                      : t('videoUnavailable');

                return (
                  <li
                    key={video.id}
                    className="flex min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-panel"
                  >
                    {available ? (
                      <Link
                        href={`/v/${video.id}`}
                        aria-label={t('openCollectionVideo', { category: categoryLabel })}
                        className="relative block w-28 shrink-0 self-stretch bg-black sm:w-32"
                      >
                        {video.posterUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed poster URL
                          <img
                            src={video.posterUrl}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="flex h-full min-h-40 items-center justify-center p-2 text-center text-xs text-fog">
                            {categoryLabel}
                          </span>
                        )}
                      </Link>
                    ) : (
                      <div className="relative flex min-h-40 w-28 shrink-0 items-center justify-center bg-gradient-to-br from-white/10 to-panel p-2 text-center text-xs text-fog sm:w-32">
                        {video.posterUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed poster URL
                          <img
                            src={video.posterUrl}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover opacity-40"
                            loading="lazy"
                          />
                        ) : (
                          categoryLabel
                        )}
                        <span className="relative rounded-full bg-black/75 px-2 py-1">
                          {unavailableLabel}
                        </span>
                      </div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col items-start gap-2 p-3">
                      <div className="flex w-full flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">
                          {categoryLabel}
                        </span>
                        {!available && (
                          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-fog">
                            {unavailableLabel}
                          </span>
                        )}
                      </div>
                      <p className="line-clamp-3 text-sm font-medium text-white">
                        {video.caption || t('noCaption')}
                      </p>
                      <div className="mt-auto flex w-full flex-col gap-1 text-xs text-fog">
                        {video.authorName && (
                          <Link
                            href={`/u/${video.authorName}`}
                            className="min-h-11 truncate text-left underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                          >
                            {t('collectionAuthor', { name: video.authorName })}
                          </Link>
                        )}
                        <time dateTime={new Date(video.savedAt).toISOString()}>
                          {t(dateKey, { when: date })}
                        </time>
                        {video.publishedAt && (
                          <time dateTime={video.publishedAt}>
                            {t('publishedOn', {
                              when: format.relativeTime(new Date(video.publishedAt), now),
                            })}
                          </time>
                        )}
                        {video.expiresAt && available && (
                          <span>
                            {t('videoExpires', {
                              when: format.relativeTime(new Date(video.expiresAt), now),
                            })}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        className="min-h-11 w-full justify-center px-2 text-xs"
                        disabled={pendingId === video.id}
                        onClick={() => void removeVideo(video.id)}
                      >
                        {pendingId === video.id ? t('collectionUpdating') : actionText}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
