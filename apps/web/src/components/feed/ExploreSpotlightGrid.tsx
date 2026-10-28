'use client';

import { CATEGORIES, type Category } from '@nl/shared';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Button, Notice } from '@/components/ui';
import { api } from '@/lib/client-api';
import type { FeedItem } from '@/lib/feed';
import { currentPosition } from '@/lib/platform';
import { formatDistance } from './format';

type SpotlightItem = Pick<
  FeedItem,
  'id' | 'category' | 'caption' | 'posterUrl' | 'author' | 'distanceM' | 'usefulCount'
>;
type Status = 'idle' | 'locating' | 'loading' | 'ready';
type ErrorKind = 'denied' | 'locationError' | 'fetchError';

const SPOTLIGHT_LIMIT = 12;

export function ExploreSpotlightGrid() {
  const t = useTranslations('discover.spotlight');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [category, setCategory] = useState<Category | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [items, setItems] = useState<SpotlightItem[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<ErrorKind | null>(null);

  async function loadSpotlight(selectedCategory: Category | null, coords = position) {
    setError(null);
    let searchPosition = coords;

    if (!searchPosition) {
      setStatus('locating');
      try {
        const fix = await currentPosition();
        searchPosition = { lat: fix.coords.latitude, lng: fix.coords.longitude };
        setPosition(searchPosition);
      } catch (reason) {
        const denied =
          typeof reason === 'object' && reason !== null && 'code' in reason && reason.code === 1;
        setError(denied ? 'denied' : 'locationError');
        setStatus('idle');
        return;
      }
    }

    setStatus('loading');
    const query = new URLSearchParams({
      lat: String(searchPosition.lat),
      lng: String(searchPosition.lng),
      radius: '3000',
      limit: String(SPOTLIGHT_LIMIT),
      sort: 'relevance',
    });
    if (selectedCategory) query.set('category', selectedCategory);

    const result = await api<{ items: SpotlightItem[] }>(`/api/feed?${query}`);
    if (!result.ok) {
      setError('fetchError');
      setStatus('idle');
      return;
    }

    setItems(result.data.items.slice(0, SPOTLIGHT_LIMIT));
    setStatus('ready');
  }

  function selectCategory(nextCategory: Category | null) {
    setCategory(nextCategory);
    setItems([]);
    if (status === 'ready') void loadSpotlight(nextCategory);
  }

  const busy = status === 'locating' || status === 'loading';

  return (
    <section aria-labelledby="spotlight-title" className="flex flex-col gap-4 sm:gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="spotlight-title" className="mt-1 text-2xl font-bold tracking-tight">
            {t('title')}
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-fog">{t('subtitle')}</p>
        </div>
        {status !== 'ready' && (
          <Button onClick={() => void loadSpotlight(category)} disabled={busy} className="shrink-0">
            {busy ? t(status) : error ? t('retry') : t('show')}
          </Button>
        )}
      </header>

      <nav aria-label={t('filtersLabel')} className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex w-max min-w-full gap-1">
          {[null, ...CATEGORIES].map((filter) => {
            const active = category === filter;
            return (
              <button
                key={filter ?? 'all'}
                type="button"
                aria-pressed={active}
                disabled={busy}
                onClick={() => selectCategory(filter)}
                className={`group relative inline-flex min-h-9 shrink-0 items-center gap-1.5 px-2.5 text-xs font-semibold transition-colors focus-visible:rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60 ${
                  active ? 'text-white' : 'text-fog hover:text-white'
                }`}
              >
                {filter && <CategoryIcon category={filter} className="h-4 w-4" />}
                {filter ? tc(`categories.${filter}`) : t('all')}
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-2 bottom-0 h-0.5 origin-center rounded-full bg-blue transition-transform duration-300 ease-out motion-reduce:transition-none ${
                    active ? 'scale-x-100' : 'scale-x-0'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </nav>

      <p className="text-xs leading-relaxed text-fog">{t('locationHint')}</p>

      {error && (
        <Notice kind="error">
          {error === 'denied'
            ? t('denied')
            : error === 'locationError'
              ? t('locationError')
              : t('fetchError')}
        </Notice>
      )}
      {busy && (
        <p role="status" className="text-sm text-fog">
          {t(status)}
        </p>
      )}
      {status === 'ready' &&
        (items.length === 0 ? (
          <p className="rounded-2xl border border-line bg-panel p-4 text-sm text-fog">
            {t('empty')}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item, index) => {
              const distance =
                item.distanceM === null ? null : formatDistance(item.distanceM, locale);
              return (
                <Link
                  key={item.id}
                  href={`/v/${item.id}`}
                  className={`group relative flex min-h-64 flex-col justify-end overflow-hidden rounded-3xl border border-line bg-panel transition duration-200 hover:-translate-y-1 hover:border-accent/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    index === 0 ? 'col-span-2 row-span-2 min-h-[22rem] sm:min-h-[26rem]' : ''
                  }`}
                >
                  {item.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed poster URL
                    <img
                      src={item.posterUrl}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-br from-panel to-ink"
                    />
                  )}
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-ink via-ink/70 to-transparent"
                  />
                  <div className="relative z-10 flex flex-col gap-2 p-4 sm:p-5">
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/10 bg-panel/80 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
                      <CategoryIcon category={item.category} className="h-3.5 w-3.5 text-blue" />
                      {tc(`categories.${item.category}`)}
                    </span>
                    <p className="video-overlay-copy line-clamp-2 text-sm font-semibold text-white sm:text-base">
                      {item.caption || tc('appName')}
                    </p>
                    <div className="flex items-center justify-between gap-2 pt-1 text-xs text-fog">
                      <span className="truncate">
                        {item.author.username ? `@${item.author.username}` : ''}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {distance && (
                          <span>
                            {distance.value} {distance.unit}
                          </span>
                        )}
                        <span aria-label={t('usefulCount', { count: item.usefulCount })}>
                          ♥{' '}
                          {new Intl.NumberFormat(locale, { notation: 'compact' }).format(
                            item.usefulCount,
                          )}
                        </span>
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
    </section>
  );
}
