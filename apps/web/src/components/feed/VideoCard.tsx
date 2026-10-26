'use client';

import { CATEGORY_COLORS } from '@nl/shared';
import Link from 'next/link';
import { useFormatter, useLocale, useTranslations, useNow } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  fit: 'cover' | 'contain';
  onToggleFit: () => void;
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
  fit,
  onToggleFit,
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
  const [mediaReloadKey, setMediaReloadKey] = useState(0);
  const [paused, setPaused] = useState(true);
  const [mediaState, setMediaState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [usefulPending, setUsefulPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const mediaRetries = useRef(0);
  const mediaRequest = useRef<{
    generation: number;
    controller: AbortController | null;
  }>({ generation: 0, controller: null });
  const [useful, setUseful] = useState({ reacted: item.reacted, count: item.usefulCount });
  const [toast, setToast] = useState<string | null>(null);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (active && autoplay) void video.play().catch(() => setPaused(true));
    if (!active || !autoplay) video.pause();
  }, [active, autoplay, mediaReloadKey, src]);

  const requestMediaUrl = useCallback(async () => {
    const generation = ++mediaRequest.current.generation;
    mediaRequest.current.controller?.abort();
    const controller = new AbortController();
    mediaRequest.current.controller = controller;

    try {
      const result = await api<FeedItem>(`/api/videos/${item.id}/media`, {
        signal: controller.signal,
      });
      if (controller.signal.aborted || generation !== mediaRequest.current.generation) return null;
      return result;
    } catch {
      return null;
    }
  }, [item.id]);

  const refreshUrl = useCallback(
    async (force = false) => {
      if (mediaRetries.current >= 1) {
        setMediaState('error');
        return;
      }
      mediaRetries.current += 1;
      const res = await requestMediaUrl();
      if (!res) {
        setMediaState('error');
        return;
      }
      if (res.ok && res.data.videoUrl) {
        const sameUrl = res.data.videoUrl === src;
        setSrc(res.data.videoUrl);
        if (force || sameUrl) setMediaReloadKey((key) => key + 1);
        setMediaState('loading');
        return;
      }
      setMediaState('error');
    },
    [requestMediaUrl, src],
  );

  useEffect(() => {
    if (!load || src || mediaRetries.current >= 1) return;

    let current = true;
    let settled = false;
    mediaRetries.current += 1;
    void requestMediaUrl().then((res) => {
      settled = true;
      if (!current || !res) return;
      if (res.ok && res.data.videoUrl) {
        mediaRetries.current = 0;
        setSrc(res.data.videoUrl);
        setMediaState('loading');
      } else {
        setMediaState('error');
      }
    });

    return () => {
      current = false;
      // A request cancelled before answering (remount, StrictMode) must not consume the attempt.
      if (!settled) mediaRetries.current -= 1;
    };
  }, [item.id, load, requestMediaUrl, src]);

  useEffect(
    () => () => {
      mediaRequest.current.generation += 1;
      mediaRequest.current.controller?.abort();
      mediaRequest.current.controller = null;
    },
    [item.id],
  );

  function retryMedia() {
    mediaRetries.current = 0;
    setMediaState('loading');
    void refreshUrl(true);
  }

  async function toggleUseful() {
    if (!signedIn) return onAuthRequired();
    if (usefulPending) return;
    setUsefulPending(true);
    const res = await api<{ reacted: boolean; usefulCount: number }>(
      `/api/videos/${item.id}/useful`,
      {
        method: useful.reacted ? 'DELETE' : 'POST',
        body: {},
      },
    );
    if (res.ok) {
      setUseful({ reacted: res.data.reacted, count: res.data.usefulCount });
    } else {
      setToast(t('usefulError'));
      setTimeout(() => setToast(null), 3000);
    }
    setUsefulPending(false);
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
      className="video-card relative h-full w-full snap-start snap-always overflow-hidden bg-black"
      aria-label={`${tc(item.category)} — ${item.caption}`}
      data-testid="feed-item"
      data-video-id={item.id}
    >
      {fit === 'contain' && (
        <div
          aria-hidden="true"
          className="absolute inset-[-2rem] z-0 bg-black bg-cover bg-center transition-opacity duration-300"
          style={{
            backgroundImage: item.posterUrl ? `url("${item.posterUrl}")` : undefined,
            filter: 'blur(28px) brightness(0.42)',
          }}
        />
      )}
      <video
        key={`${item.id}:${mediaReloadKey}`}
        ref={ref}
        src={load && src ? src : undefined}
        poster={item.posterUrl ?? undefined}
        preload={load ? 'auto' : 'none'}
        playsInline
        muted={muted}
        loop
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onLoadedData={() => {
          mediaRetries.current = 0;
          setMediaState('ready');
        }}
        onTimeUpdate={(event) => {
          const video = event.currentTarget;
          if (Number.isFinite(video.duration) && video.duration > 0) {
            setProgress((video.currentTime / video.duration) * 100);
          }
        }}
        onError={() => {
          if (load && src) void refreshUrl();
        }}
        onClick={togglePlay}
        className={`relative z-10 h-full w-full ${fit === 'cover' ? 'object-cover' : 'object-contain'}`}
      />
      <div
        role="progressbar"
        aria-label={t('playbackProgress')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-0.5 bg-white/30"
      >
        <div
          className="h-full bg-white/90 transition-[width] duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>
      <button
        type="button"
        onClick={onToggleFit}
        aria-label={fit === 'cover' ? t('showEntireVideo') : t('fillScreen')}
        className="glass absolute right-4 top-[10.5rem] z-20 flex h-11 w-11 items-center justify-center rounded-full text-white transition-[transform,background-color] duration-200 ease-out hover:scale-105 hover:bg-white/20 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {fit === 'cover' ? (
            <path d="M8 3H5a2 2 0 00-2 2v3m13-5h3a2 2 0 012 2v3M3 16v3a2 2 0 002 2h3m13-5v3a2 2 0 01-2 2h-3" />
          ) : (
            <path d="M8 3v5H3m13-5v5h5M3 16h5v5m13-5h-5v5" />
          )}
        </svg>
      </button>
      {load && mediaState === 'loading' && (
        <p
          role="status"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-sm text-white"
        >
          {t('mediaLoading')}
        </p>
      )}
      {load && mediaState === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 p-6 text-center">
          <p role="alert" className="text-sm text-white">
            {t('mediaUnavailable')}
          </p>
          <button
            type="button"
            onClick={retryMedia}
            className="min-h-11 rounded-xl bg-white px-4 py-2 font-semibold text-ink transition-[transform,background-color] duration-200 ease-out hover:scale-[1.02] hover:bg-white/90 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {t('retryMedia')}
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={togglePlay}
        aria-label={paused ? t('play') : t('pause')}
        disabled={mediaState !== 'ready'}
        className={`glass absolute left-1/2 top-1/2 flex h-18 w-18 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-[opacity,transform,background-color] duration-200 ease-out hover:scale-105 hover:bg-white/20 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:hidden ${paused ? 'opacity-100' : 'opacity-0 focus:opacity-100'}`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
          {paused ? <path d="M7 4.5v15l12-7.5z" /> : <path d="M6 5h4v14H6zm8 0h4v14h-4z" />}
        </svg>
      </button>

      <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10">
        <div className="glass pointer-events-auto flex w-fit max-w-[calc(100%-5rem)] flex-col gap-2.5 rounded-3xl p-4 shadow-2xl shadow-black/30">
          <Link
            href={`/u/${item.author.username}`}
            className="flex min-h-11 w-fit items-center gap-2.5 rounded-full pr-2 text-sm font-semibold text-white"
          >
            <span className="rounded-full bg-accent p-0.5">
              <Avatar
                username={item.author.username}
                color={item.author.color}
                size={34}
                src={item.author.avatarUrl}
              />
            </span>
            <span className="flex flex-col leading-tight">
              @{item.author.username}
              {distance && (
                <span className="text-xs font-normal text-white/70">
                  {t('distance', { distance: t(distance.unit, { value: distance.value }) })}
                </span>
              )}
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className="rounded-full px-2.5 py-1 font-bold text-white shadow-lg"
              style={{ backgroundColor: CATEGORY_COLORS[item.category] }}
            >
              {tc(item.category)}
            </span>
            {item.isMerchant && (
              <span className="rounded-full bg-amber-400 px-2.5 py-1 font-bold text-ink">
                {t('merchant')}
              </span>
            )}
            <span className="glass rounded-full px-2.5 py-1 text-white/80">
              {t('expires', { when: format.relativeTime(new Date(item.expiresAt), now) })}
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
                  className="min-h-11 rounded-lg px-1 text-left text-sm font-semibold text-white underline underline-offset-4 transition-colors duration-200 ease-out hover:text-white/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {captionExpanded ? t('captionLess') : t('captionMore')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="absolute right-2 bottom-8 z-20 flex flex-col items-center gap-3 text-xs font-semibold text-white">
        <ActionButton
          label={t('usefulCount', { count: useful.count })}
          pressed={useful.reacted}
          onClick={toggleUseful}
          disabled={usefulPending}
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
          className="absolute left-1/2 top-20 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-sm text-white"
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
  disabled = false,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      disabled={disabled}
      className="group flex w-16 flex-col items-center gap-1 text-center transition-[transform,opacity] duration-200 ease-out hover:scale-105 active:scale-95 focus-visible:rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:pointer-events-none disabled:opacity-60"
    >
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-full transition-[transform,background-color,color,box-shadow] duration-200 ease-out group-hover:bg-white/20 group-hover:text-white group-active:scale-95 ${pressed ? 'glow bg-accent text-white group-hover:bg-accent/80' : 'glass text-white'}`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-6 w-6 transition-transform duration-200 ease-out group-hover:scale-110"
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
