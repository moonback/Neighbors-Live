'use client';

import { CATEGORY_COLORS } from '@nl/shared';
import Link from 'next/link';
import { useFormatter, useLocale, useTranslations, useNow } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { api } from '@/lib/client-api';
import type { FeedItem } from '@/lib/feed';
import { formatDistance } from './format';

interface Props {
  item: FeedItem;
  active: boolean;
  /** Only the visible video and the next one get a source (preload next only). */
  load: boolean;
  muted: boolean;
  autoplay: boolean;
  onToggleMute: () => void;
  onComments: (item: FeedItem) => void;
  onReport: (item: FeedItem) => void;
  onAuthRequired: () => void;
  signedIn: boolean;
}

export function VideoCard({
  item,
  active,
  load,
  muted,
  autoplay,
  onToggleMute,
  onComments,
  onReport,
  onAuthRequired,
  signedIn,
}: Props) {
  const t = useTranslations('video');
  const tc = useTranslations('common.categories');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const locale = useLocale();
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState(item.videoUrl);
  const [paused, setPaused] = useState(true);
  const [useful, setUseful] = useState({ reacted: item.reacted, count: item.usefulCount });
  const [toast, setToast] = useState<string | null>(null);
  const [captionExpanded, setCaptionExpanded] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (active && autoplay) void video.play().catch(() => setPaused(true));
    if (!active || !autoplay) video.pause();
  }, [active, autoplay, src]);

  async function refreshUrl() {
    // Signed URLs are short-lived: fetch a fresh one when playback fails.
    const res = await api<FeedItem>(`/api/videos/${item.id}/media`);
    if (res.ok && res.data.videoUrl && res.data.videoUrl !== src) setSrc(res.data.videoUrl);
  }

  async function toggleUseful() {
    if (!signedIn) return onAuthRequired();
    const res = await api<{ reacted: boolean; usefulCount: number }>(
      `/api/videos/${item.id}/useful`,
      {
        method: useful.reacted ? 'DELETE' : 'POST',
        body: {},
      },
    );
    if (res.ok) setUseful({ reacted: res.data.reacted, count: res.data.usefulCount });
  }

  async function share() {
    const url = `${window.location.origin}/v/${item.id}`;
    try {
      if (navigator.share)
        await navigator.share({ title: tc(item.category), text: item.caption, url });
      else {
        await navigator.clipboard.writeText(url);
        setToast(t('shared'));
        setTimeout(() => setToast(null), 2000);
      }
    } catch {
      /* share sheet dismissed */
    }
  }

  function togglePlay() {
    const video = ref.current;
    if (!video) return;
    if (video.paused)
      void video.play().catch(() => {
        setPaused(true);
        setToast(t('playbackError'));
        setTimeout(() => setToast(null), 3000);
      });
    else video.pause();
  }

  const distance = item.distanceM === null ? null : formatDistance(item.distanceM, locale);

  return (
    <article
      className="relative h-full w-full snap-start snap-always overflow-hidden bg-black"
      aria-label={`${tc(item.category)} — ${item.caption}`}
      data-testid="feed-item"
      data-video-id={item.id}
    >
      <video
        ref={ref}
        src={load && src ? src : undefined}
        poster={item.posterUrl ?? undefined}
        preload={load ? 'auto' : 'none'}
        playsInline
        muted={muted}
        loop
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onError={() => void refreshUrl()}
        onClick={togglePlay}
        className="h-full w-full object-cover"
      />
      <button
        type="button"
        onClick={togglePlay}
        aria-label={paused ? t('play') : t('pause')}
        className={`absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-3xl transition-opacity ${paused ? 'opacity-100' : 'opacity-0 focus:opacity-100'}`}
      >
        <span aria-hidden="true">{paused ? '▶' : '❚❚'}</span>
      </button>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-4 pb-6 pt-24">
        <div className="pointer-events-auto flex max-w-[calc(100%-5rem)] flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className="rounded-full px-2 py-0.5 font-bold text-white"
              style={{ backgroundColor: CATEGORY_COLORS[item.category] }}
            >
              {tc(item.category)}
            </span>
            {item.isMerchant && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 font-bold text-ink">
                {t('merchant')}
              </span>
            )}
            {distance && (
              <span className="text-fog">
                {t('distance', { distance: t(distance.unit, { value: distance.value }) })}
              </span>
            )}
            <span className="text-fog">
              · {t('expires', { when: format.relativeTime(new Date(item.expiresAt), now) })}
            </span>
          </div>
          {item.caption && (
            <div className="flex flex-col items-start gap-1">
              <p
                className={`text-base font-medium leading-snug ${captionExpanded ? '' : 'line-clamp-3'}`}
              >
                {item.caption}
              </p>
              {item.caption.length > 100 && (
                <button
                  type="button"
                  aria-expanded={captionExpanded}
                  onClick={() => setCaptionExpanded((expanded) => !expanded)}
                  className="min-h-11 rounded-lg px-1 text-left text-sm font-semibold text-white underline underline-offset-4"
                >
                  {captionExpanded ? t('captionLess') : t('captionMore')}
                </button>
              )}
            </div>
          )}
          <Link
            href={`/u/${item.author.username}`}
            className="flex items-center gap-2 text-sm text-fog"
          >
            <Avatar username={item.author.username} color={item.author.color} size={28} />
            {t('by', { username: item.author.username ?? '' })}
          </Link>
        </div>
      </div>

      <div className="absolute bottom-6 right-3 flex flex-col items-center gap-4 text-xs">
        <ActionButton
          label={t('usefulCount', { count: useful.count })}
          pressed={useful.reacted}
          onClick={toggleUseful}
          icon="M7 11v9H4v-9zm2 9h8.5a2 2 0 002-1.6l1.4-6A2 2 0 0019 10h-5V6a2 2 0 00-2-2l-3 7z"
        />
        <ActionButton
          label={t('comments', { count: item.commentCount })}
          onClick={() => onComments(item)}
          icon="M4 5h16v11H8l-4 4z"
        />
        <ActionButton
          label={t('share')}
          onClick={share}
          icon="M14 5l6 6-6 6M20 11H9a5 5 0 00-5 5v3"
        />
        <ActionButton
          label={t('report')}
          onClick={() => (signedIn ? onReport(item) : onAuthRequired())}
          icon="M5 21V4h11l-1.5 4L16 12H5"
        />
        <ActionButton
          label={muted ? t('unmute') : t('mute')}
          onClick={onToggleMute}
          icon={
            muted
              ? 'M4 9h4l5-4v14l-5-4H4zM17 9l4 6m0-6l-4 6'
              : 'M4 9h4l5-4v14l-5-4H4zM16 8a5 5 0 010 8m2.5-10.5a8.5 8.5 0 010 13'
          }
        />
      </div>
      {toast && (
        <p
          role="status"
          className="absolute left-1/2 top-20 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-sm"
        >
          {toast}
        </p>
      )}
    </article>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  pressed,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className="flex w-16 flex-col items-center gap-1 text-center"
    >
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-full ${pressed ? 'bg-accent text-ink' : 'bg-black/50 text-white'}`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d={icon} />
        </svg>
      </span>
      <span className="leading-tight drop-shadow">{label}</span>
    </button>
  );
}
