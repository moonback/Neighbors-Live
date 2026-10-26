'use client';

import { CATEGORIES, RADII_M, type Category } from '@nl/shared';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Logo } from '@/components/Logo';
import { PermissionPrimer } from '@/components/PermissionPrimer';
import { Button, Notice } from '@/components/ui';
import { api } from '@/lib/client-api';
import type { FeedItem } from '@/lib/feed';
import { useLocation } from '@/lib/useLocation';
import { AlertsBanner } from './AlertsBanner';
import { VideoCard } from './VideoCard';

// Sheets are only needed once opened.
const Comments = dynamic(() => import('./Comments').then((m) => m.Comments), { ssr: false });
const ReportDialog = dynamic(() => import('./ReportDialog').then((m) => m.ReportDialog), {
  ssr: false,
});

interface Props {
  initialRadius: number;
  signedIn: boolean;
  focusId: string | null;
  initialCategory: Category | null;
  notice: string | null;
}

type Status = 'idle' | 'loading' | 'ready' | 'error';

export function Feed({ initialRadius, signedIn, focusId, initialCategory, notice }: Props) {
  const t = useTranslations('feed');
  const tc = useTranslations('common');
  const router = useRouter();
  const { state: location, locate, dismiss } = useLocation();
  const [radius, setRadius] = useState(initialRadius);
  const [category, setCategory] = useState<Category | null>(initialCategory);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [autoplay, setAutoplay] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const loadingMore = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setAutoplay(!mq.matches);
    const timer = setTimeout(apply, 0);
    mq.addEventListener('change', apply);
    return () => {
      clearTimeout(timer);
      mq.removeEventListener('change', apply);
    };
  }, []);

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
    if (lat === null) return;
    let alive = true;
    const run = async () => {
      setStatus('loading');
      const [page, focused] = await Promise.all([
        fetchPage(null),
        focusId ? api<FeedItem>(`/api/videos/${focusId}/media`) : Promise.resolve(null),
      ]);
      if (!alive) return;
      if (!page?.ok) return setStatus('error');
      const first = focused?.ok ? [focused.data] : [];
      setItems([...first, ...page.data.items.filter((i) => i.id !== focusId)]);
      setCursor(page.data.nextCursor);
      setActive(0);
      listRef.current?.scrollTo({ top: 0 });
      setStatus('ready');
    };
    void run();
    return () => {
      alive = false;
    };
  }, [fetchPage, focusId, lat, reloadKey]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore.current) return;
    loadingMore.current = true;
    const page = await fetchPage(cursor);
    loadingMore.current = false;
    if (page?.ok) {
      setItems((prev) => [
        ...prev,
        ...page.data.items.filter((i) => !prev.some((p) => p.id === i.id)),
      ]);
      setCursor(page.data.nextCursor);
    }
  }, [cursor, fetchPage]);

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
    <div className="relative h-[calc(100dvh-4.5rem)] w-full">
      <PermissionPrimer
        open={location.status === 'primer'}
        title={t('location.primerTitle')}
        confirmLabel={t('location.allow')}
        cancelLabel={t('location.later')}
        onConfirm={() => void locate()}
        onCancel={dismiss}
      >
        <p>{t('location.primerBody')}</p>
      </PermissionPrimer>

      <header className="absolute inset-x-0 top-0 z-20 flex flex-col gap-3 bg-gradient-to-b from-ink/95 via-ink/60 to-transparent px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-8">
        <h1 className="sr-only">{t('title')}</h1>
        <div className="flex items-center justify-between gap-3">
          <Logo name={tc('appName')} size={26} />
          <label className="sr-only" htmlFor="feed-radius">
            {t('filters.radius')}
          </label>
          <div className="glass flex items-center gap-1.5 rounded-full pl-3">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4 text-accent"
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
              className="min-h-10 appearance-none rounded-full bg-transparent pr-4 text-sm font-semibold focus:outline-none"
            >
              {RADII_M.map((r) => (
                <option key={r} value={r} className="bg-panel">
                  {tc(`radius.${r}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <nav
          aria-label={t('filters.label')}
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
        >
          <FilterChip active={category === null} onClick={() => setCategory(null)}>
            {t('filters.all')}
          </FilterChip>
          {CATEGORIES.map((c) => (
            <FilterChip key={c} active={category === c} onClick={() => setCategory(c)}>
              {tc(`categories.${c}`)}
            </FilterChip>
          ))}
        </nav>
        {category === 'alert' && (
          <p className="rounded-xl border border-alert/50 bg-black/80 px-3 py-2 text-sm text-white">
            {t('alerts.notice')}
          </p>
        )}
        {coords && (
          <AlertsBanner
            lat={coords.lat}
            lng={coords.lng}
            radius={radius}
            onShow={() => setCategory('alert')}
          />
        )}
        {notice && <Notice kind="success">{notice}</Notice>}
      </header>

      {location.status !== 'ok' && location.status !== 'primer' && (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
          {location.status === 'locating' || location.status === 'unknown' ? (
            <p role="status" className="text-fog">
              {t('location.locating')}
            </p>
          ) : (
            <>
              <Notice kind={location.status === 'denied' ? 'error' : 'info'}>
                {location.status === 'denied' ? t('location.denied') : t('location.needed')}
              </Notice>
              <Button onClick={() => void locate()}>{t('location.allow')}</Button>
            </>
          )}
        </div>
      )}

      {coords && status === 'loading' && items.length === 0 && <FeedSkeleton />}

      {coords && status === 'error' && (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
          <Notice kind="error">{t('error')}</Notice>
          <Button onClick={() => setReloadKey((k) => k + 1)}>{tc('actions.retry')}</Button>
        </div>
      )}

      {coords && status === 'ready' && items.length === 0 && (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
          <span className="glass mb-2 flex h-20 w-20 items-center justify-center rounded-3xl">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-9 w-9 text-accent"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            >
              <path d="M3 7h12v10H3zM15 10l6-3v10l-6-3" />
            </svg>
          </span>
          <h2 className="text-2xl font-bold">{t('empty.title')}</h2>
          <p className="max-w-xs text-fog">{t('empty.body')}</p>
          <Link
            href="/filmer"
            className="glow rounded-2xl bg-accent px-6 py-3 font-semibold text-ink"
          >
            {t('empty.cta')}
          </Link>
          {wider && (
            <Button variant="secondary" onClick={() => setRadius(wider)}>
              {t('empty.wider', { radius: tc(`radius.${wider}`) })}
            </Button>
          )}
        </div>
      )}

      {items.length > 0 && (
        <div
          ref={listRef}
          className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain"
          aria-busy={status === 'loading'}
        >
          {items.map((item, index) => (
            <div key={item.id} data-index={index} className="h-full w-full">
              <VideoCard
                item={item}
                active={index === active}
                load={index === active || index === active + 1}
                muted={muted}
                autoplay={autoplay}
                onToggleMute={() => setMuted((m) => !m)}
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
        <Comments videoId={commentsFor} signedIn={signedIn} onClose={() => setCommentsFor(null)} />
      )}
      {reportFor && <ReportDialog videoId={reportFor} onClose={() => setReportFor(null)} />}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-medium transition ${active ? 'glow bg-accent font-semibold text-white' : 'glass text-white/90 hover:text-white'}`}
    >
      {children}
    </button>
  );
}

function FeedSkeleton() {
  return (
    <div
      className="flex h-full flex-col justify-end gap-3 bg-panel p-4 pb-8 motion-safe:animate-pulse"
      aria-hidden="true"
    >
      <div className="h-5 w-24 rounded-full bg-line" />
      <div className="h-5 w-3/4 rounded bg-line" />
      <div className="h-4 w-1/2 rounded bg-line" />
    </div>
  );
}
