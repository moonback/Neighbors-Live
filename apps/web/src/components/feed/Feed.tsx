'use client';

import { CATEGORIES, RADII_M, type Category } from '@nl/shared';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Logo } from '@/components/Logo';
import { Button, Notice } from '@/components/ui';
import { api } from '@/lib/client-api';
import type { FeedItem } from '@/lib/feed';
import { fetchHiddenVideoIds, isVideoHidden, readHiddenVideoIds } from '@/lib/hidden-videos';
import { useLocation } from '@/lib/useLocation';
import { useNeighborhoodFilters } from '@/lib/useNeighborhoodFilters';
import { getVideoMuted, setVideoMuted, subscribeToVideoMuted } from '@/lib/video-preferences';
import { AlertsBanner } from './AlertsBanner';
import { VideoCard } from './VideoCard';
import { WelcomeHero } from './WelcomeHero';

// Sheets are only needed once opened.
const Comments = dynamic(() => import('./Comments').then((m) => m.Comments), { ssr: false });
const ReportDialog = dynamic(() => import('./ReportDialog').then((m) => m.ReportDialog), {
  ssr: false,
});

interface Props {
  initialRadius: number;
  signedIn: boolean;
  focusId: string | null;
  returnToMap: boolean;
  initialCategory: Category | null;
  notice: string | null;
}

type Status = 'idle' | 'loading' | 'ready' | 'error';
type VideoFit = 'cover' | 'contain';

const VIDEO_FIT_KEY = 'nl-video-fit';
const VIDEO_FIT_EVENT = 'nl-video-fit-change';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const EMPTY_HIDDEN_IDS = new Set<string>();

function getVideoFitSnapshot(): VideoFit {
  if (typeof window === 'undefined') return 'cover';
  try {
    const savedFit = window.localStorage.getItem(VIDEO_FIT_KEY);
    return savedFit === 'contain' ? 'contain' : 'cover';
  } catch {
    return 'cover';
  }
}

function subscribeToVideoFit(onChange: () => void) {
  window.addEventListener(VIDEO_FIT_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(VIDEO_FIT_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

function saveVideoFit(fit: VideoFit) {
  try {
    window.localStorage.setItem(VIDEO_FIT_KEY, fit);
  } catch {
    // Keep the in-memory preference usable when browser storage is unavailable.
  }
  window.dispatchEvent(new Event(VIDEO_FIT_EVENT));
}

function getReducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function subscribeToReducedMotion(onChange: () => void) {
  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQuery.addEventListener('change', onChange);
  return () => mediaQuery.removeEventListener('change', onChange);
}

export function Feed({
  initialRadius,
  signedIn,
  focusId,
  returnToMap,
  initialCategory,
  notice,
}: Props) {
  const t = useTranslations('feed');
  const tc = useTranslations('common');
  const router = useRouter();
  const { state: location, locate, dismiss } = useLocation();
  const {
    radius,
    setRadius,
    category,
    setCategory,
    reset: resetFilters,
    customized: filtersCustomized,
    ready: filtersReady,
  } = useNeighborhoodFilters(initialRadius, initialCategory);
  const clearCategoryQuery = () => {
    if (!initialCategory) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('category')) return;
    params.delete('category');
    const query = params.toString();
    router.replace(query ? `/?${query}` : '/', { scroll: false });
  };
  const changeCategory = (nextCategory: Category | null) => {
    setCategory(nextCategory);
    clearCategoryQuery();
  };
  const handleResetFilters = () => {
    resetFilters();
    clearCategoryQuery();
  };
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [active, setActive] = useState(0);
  const muted = useSyncExternalStore(subscribeToVideoMuted, getVideoMuted, () => true);
  const videoFit = useSyncExternalStore(
    subscribeToVideoFit,
    getVideoFitSnapshot,
    (): VideoFit => 'cover',
  );
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [hiddenVersion, setHiddenVersion] = useState(0);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(
    () => new Set(signedIn ? readHiddenVideoIds() : []),
  );
  const serverHiddenIds = signedIn ? hiddenIds : EMPTY_HIDDEN_IDS;
  const autoplay = !prefersReducedMotion && commentsFor === null && reportFor === null;
  const listRef = useRef<HTMLDivElement>(null);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const loadingMore = useRef(false);

  useEffect(() => {
    if (!isCategoryMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!categoryMenuRef.current?.contains(event.target as Node)) {
        setIsCategoryMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsCategoryMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isCategoryMenuOpen]);

  useEffect(() => {
    const handle = () => {
      setHiddenVersion((value) => value + 1);
      if (!signedIn) return;
      void fetchHiddenVideoIds()
        .then((ids) => setHiddenIds(new Set(ids)))
        .catch(() => setHiddenIds(new Set()));
    };
    window.addEventListener('nl-hidden-videos-change', handle);
    return () => window.removeEventListener('nl-hidden-videos-change', handle);
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn) return;
    void fetchHiddenVideoIds()
      .then((ids) => setHiddenIds(new Set(ids)))
      .catch(() => setHiddenIds(new Set()));
  }, [signedIn]);

  const lat = location.status === 'ok' ? location.lat : null;
  const lng = location.status === 'ok' ? location.lng : null;
  const coords = lat !== null && lng !== null ? { lat, lng } : null;
  const [reloadKey, setReloadKey] = useState(0);

  const fetchPage = useCallback(
    async (after: string | null) => {
      if (lat === null || lng === null) return null;
      const qs = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        radius: String(radius),
      });
      if (category) qs.set('category', category);
      if (after) qs.set('cursor', after);
      return api<{ items: FeedItem[]; nextCursor: string | null }>(`/api/feed?${qs}`);
    },
    [lat, lng, radius, category],
  );

  // First page (and focused deep-linked video) whenever position or filters change.
  useEffect(() => {
    if (!filtersReady || lat === null) return;
    let alive = true;
    const run = async () => {
      setStatus('loading');
      const [page, focused] = await Promise.all([
        fetchPage(null),
        focusId ? api<FeedItem>(`/api/videos/${focusId}/media`) : Promise.resolve(null),
      ]);
      if (!alive) return;
      if (!page?.ok) return setStatus('error');
      const visible = page.data.items.filter(
        (item) => !serverHiddenIds.has(item.id) && !isVideoHidden(item.id),
      );
      const first =
        focused?.ok && !serverHiddenIds.has(focused.data.id) && !isVideoHidden(focused.data.id)
          ? [focused.data]
          : [];
      setItems([...first, ...visible.filter((i) => i.id !== focusId)]);
      setCursor(page.data.nextCursor);
      setActive(0);
      listRef.current?.scrollTo({ top: 0 });
      setStatus('ready');
    };
    void run();
    return () => {
      alive = false;
    };
  }, [fetchPage, filtersReady, focusId, lat, reloadKey, hiddenVersion, serverHiddenIds]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore.current) return;
    loadingMore.current = true;
    const page = await fetchPage(cursor);
    loadingMore.current = false;
    if (page?.ok) {
      setItems((prev) => [
        ...prev,
        ...page.data.items
          .filter((i) => !serverHiddenIds.has(i.id) && !isVideoHidden(i.id))
          .filter((i) => !prev.some((p) => p.id === i.id)),
      ]);
      setCursor(page.data.nextCursor);
    }
  }, [cursor, fetchPage, serverHiddenIds]);

  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  // The card that is ≥60 % visible becomes active (autoplay), the next one is preloaded;
  // nearing the end of the list fetches the next page.
  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const count = items.length;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting || e.intersectionRatio < 0.6) continue;
          const index = Number((e.target as HTMLElement).dataset.index);
          setActive(index);
          if (index >= count - 2) void loadMoreRef.current();
        }
      },
      { root, threshold: [0.6] },
    );
    root.querySelectorAll<HTMLElement>('[data-index]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  const goLogin = () => router.push('/login?next=/');
  const wider = RADII_M.find((r) => r > radius);

  return (
    <div className="feed-stage relative w-full">
      {!coords && (
        <WelcomeHero
          status={location.status}
          signedIn={signedIn}
          notice={notice}
          onLocate={() => void locate()}
          onLater={dismiss}
        />
      )}

      {coords && (
        <header className="feed-header absolute inset-x-0 top-0 z-20 flex flex-col gap-1.5 px-3 pt-2 pb-2 text-white sm:px-4">
          <h1 className="sr-only">{t('title')}</h1>
          <div className="flex min-w-0 items-center gap-1.5">
            <Logo name={tc('appName')} size={22} className="shrink-0" />
            <AlertsBanner
              lat={coords.lat}
              lng={coords.lng}
              radius={radius}
              onShow={() => changeCategory('alert')}
            />
            <label className="sr-only" htmlFor="feed-radius">
              {t('filters.radius')}
            </label>
            <div className="glass ml-auto flex shrink-0 items-center gap-1 rounded-full pl-2.5">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 text-accent"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 21s-7-6.1-7-11.5A7 7 0 0112 2.5a7 7 0 017 7C19 14.9 12 21 12 21z" />
                <circle cx="12" cy="9.5" r="2.5" />
              </svg>
              <select
                id="feed-radius"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="min-h-9 appearance-none rounded-full bg-transparent pr-3 text-xs font-semibold focus:outline-none"
              >
                {RADII_M.map((r) => (
                  <option key={r} value={r} className="bg-panel">
                    {tc(`radius.${r}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div
            ref={categoryMenuRef}
            className="relative flex w-fit max-w-full items-center gap-2 pl-0.5"
          >
            <button
              type="button"
              aria-label={`${t('filters.label')}: ${category ? tc(`categories.${category}`) : t('filters.all')}`}
              aria-expanded={isCategoryMenuOpen}
              aria-controls="feed-category-options"
              onClick={() => setIsCategoryMenuOpen((open) => !open)}
              className="glass inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-white shadow-lg shadow-black/10"
            >
              {category ? (
                <CategoryIcon category={category} />
              ) : (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 6h16l-6.5 7.5V19l-3 1v-6.5L4 6z" />
                </svg>
              )}
              <span className="truncate">
                {category ? tc(`categories.${category}`) : t('filters.all')}
              </span>
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className={`h-4 w-4 shrink-0 transition-transform ${isCategoryMenuOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m5 7 5 5 5-5" />
              </svg>
            </button>
            {isCategoryMenuOpen && (
              <nav
                id="feed-category-options"
                aria-label={t('filters.label')}
                className="glass absolute left-0 top-full z-30 mt-2 grid max-h-[min(60svh,24rem)] w-[min(20rem,calc(100vw-2rem))] grid-cols-2 gap-2 overflow-y-auto rounded-2xl p-3 shadow-xl"
              >
                <FilterChip
                  active={category === null}
                  onClick={() => {
                    changeCategory(null);
                    setIsCategoryMenuOpen(false);
                  }}
                  className="w-full justify-start rounded-xl px-3"
                >
                  {t('filters.all')}
                </FilterChip>
                {CATEGORIES.map((c) => (
                  <FilterChip
                    key={c}
                    active={category === c}
                    onClick={() => {
                      changeCategory(c);
                      setIsCategoryMenuOpen(false);
                    }}
                    className="w-full justify-start rounded-xl px-3"
                  >
                    <CategoryIcon category={c} />
                    {tc(`categories.${c}`)}
                  </FilterChip>
                ))}
              </nav>
            )}
            {filtersCustomized && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="glass inline-flex min-h-9 items-center rounded-full px-3 text-xs font-semibold text-white/90 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {t('filters.reset')}
              </button>
            )}
          </div>
          {category === 'alert' && (
            <p className="rounded-xl border border-alert/50 bg-black/80 px-3 py-2 text-sm text-white">
              {t('alerts.notice')}
            </p>
          )}
          {returnToMap && (
            <Link
              href="/carte"
              className="glass inline-flex min-h-11 w-fit items-center gap-2 rounded-full px-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
              {t('returnToMap')}
            </Link>
          )}
          {notice && <Notice kind="success">{notice}</Notice>}
        </header>
      )}

      {coords && status === 'loading' && items.length === 0 && <FeedSkeleton />}

      {coords && status === 'error' && (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6 pt-36 text-center">
          <Illustration dim />
          <Notice kind="error">{t('error')}</Notice>
          <Button onClick={() => setReloadKey((k) => k + 1)}>{tc('actions.retry')}</Button>
        </div>
      )}

      {coords && status === 'ready' && items.length === 0 && (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6 pt-36 text-center">
          <Illustration />
          <h2 className="text-2xl font-bold">{t('empty.title')}</h2>
          <p className="max-w-sm text-fog">
            {category
              ? t('empty.filtered', {
                  category: tc(`categories.${category}`),
                  radius: tc(`radius.${radius}`),
                })
              : t('empty.radius', { radius: tc(`radius.${radius}`) })}
          </p>
          <p className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80">
            {t('empty.searchArea', { radius: tc(`radius.${radius}`) })}
          </p>
          <Link
            href="/filmer"
            className="glow rounded-2xl bg-accent px-6 py-3 font-semibold text-ink"
          >
            {t('empty.cta')}
          </Link>
          <div className="flex flex-wrap justify-center gap-2">
            {category && (
              <Button variant="secondary" onClick={() => changeCategory(null)}>
                {t('empty.clearCategory')}
              </Button>
            )}
            {wider && (
              <Button variant="secondary" onClick={() => setRadius(wider)}>
                {t('empty.wider', { radius: tc(`radius.${wider}`) })}
              </Button>
            )}
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div
          ref={listRef}
          className="feed-list h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain"
          aria-busy={status === 'loading'}
        >
          {items.map((item, index) => (
            <div key={item.id} data-index={index} className="h-full w-full">
              <VideoCard
                item={item}
                active={index === active}
                load={index === active || index === active + 1}
                muted={muted}
                fit={videoFit}
                onToggleFit={() => saveVideoFit(videoFit === 'cover' ? 'contain' : 'cover')}
                autoplay={autoplay}
                onToggleMute={() => setVideoMuted(!muted)}
                onComments={(i) => setCommentsFor(i.id)}
                onReport={(i) => setReportFor(i.id)}
                onAuthRequired={goLogin}
                signedIn={signedIn}
              />
            </div>
          ))}
          <p className="py-6 text-center text-sm text-fog" role="status">
            {cursor ? t('loadingMore') : t('end')}
          </p>
        </div>
      )}

      {commentsFor && (
        <Comments
          key={commentsFor}
          videoId={commentsFor}
          signedIn={signedIn}
          onClose={() => setCommentsFor(null)}
        />
      )}
      {reportFor && <ReportDialog videoId={reportFor} onClose={() => setReportFor(null)} />}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  className = '',
  children,
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition ${active ? 'glow bg-accent font-semibold text-white' : 'glass text-white/90 hover:text-white'} ${className}`}
    >
      {children}
    </button>
  );
}

function Illustration({ dim = false }: { dim?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static decorative SVG
    <img
      src="/illustrations/radar.svg"
      alt=""
      width={176}
      height={176}
      className={`mb-2 h-44 w-44 ${dim ? 'opacity-50 grayscale' : ''}`}
    />
  );
}

function FeedSkeleton() {
  return (
    <div
      className="relative flex h-full flex-col items-center justify-center bg-gradient-to-b from-panel to-ink"
      aria-hidden="true"
    >
      <Illustration />
      <div className="absolute inset-x-4 bottom-8 flex flex-col gap-3 motion-safe:animate-pulse">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-full bg-white/10" />
          <div className="h-4 w-28 rounded-full bg-white/10" />
        </div>
        <div className="h-4 w-3/4 rounded-full bg-white/10" />
        <div className="h-4 w-1/2 rounded-full bg-white/10" />
      </div>
    </div>
  );
}
