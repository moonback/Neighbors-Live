'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/Avatar';

interface Entry {
  username: string;
  color: string;
  avatarUrl: string | null;
  name: string;
  description: string;
  website?: string | null;
  phone?: string | null;
  address?: string | null;
  openingHours?: string | null;
}

export function ShopDirectory({ entries }: { entries: Entry[] }) {
  const t = useTranslations('merchant.landing.directory');
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () =>
      entries.filter((entry) =>
        `${entry.name} ${entry.description} ${entry.address ?? ''} ${entry.website ?? ''} ${entry.phone ?? ''} ${entry.openingHours ?? ''}`
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      ),
    [entries, normalizedQuery],
  );

  return (
    <section aria-labelledby="shop-directory-title" className="flex flex-col gap-4">
      <h2 id="shop-directory-title" className="sr-only">
        {t('title')}
      </h2>
      <label className="relative flex flex-col gap-2 text-sm font-semibold">
        <span className="sr-only">{t('searchLabel')}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-fog"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('searchPlaceholder')}
          className="min-h-12 rounded-2xl border border-white/10 bg-panel/80 pr-4 pl-12 font-normal text-white placeholder:text-fog focus:border-accent focus:ring-4 focus:ring-accent/20 focus:outline-none"
        />
      </label>
      <p className="text-sm text-fog" role="status" aria-live="polite">
        {filtered.length
          ? t('count', { count: filtered.length })
          : query
            ? t('noResults')
            : t('count', { count: 0 })}
      </p>
      <p className="-mt-3 text-xs text-fog">{t('scope')}</p>
      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-fog">
          {query ? t('noResults') : t('empty')}
        </p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {filtered.map((entry) => (
            <li key={entry.username}>
              <Link
                href={`/u/${encodeURIComponent(entry.username)}`}
                className="group flex h-full items-center gap-4 rounded-3xl border border-white/[0.07] bg-panel/80 p-3 pr-4 transition hover:border-accent/50 hover:bg-panel"
              >
                <span className="overflow-hidden rounded-2xl">
                  <span className="block [&>span]:rounded-none!">
                    <Avatar
                      username={entry.name}
                      color={entry.color}
                      size={64}
                      src={entry.avatarUrl}
                    />
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{entry.name}</span>
                  <span className="block text-xs text-fog">@{entry.username}</span>
                  <span className="mt-1 line-clamp-2 block text-sm leading-snug text-fog">
                    {entry.description || t('noDescription')}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-2 text-[11px] text-fog">
                    {entry.website && (
                      <span
                        className="rounded-full border border-white/10 px-2 py-1"
                        title={entry.website}
                      >
                        {t('website')}
                      </span>
                    )}
                    {entry.phone && (
                      <span
                        className="rounded-full border border-white/10 px-2 py-1"
                        title={entry.phone}
                      >
                        {t('phone')}
                      </span>
                    )}
                    {entry.address && (
                      <span
                        className="rounded-full border border-white/10 px-2 py-1"
                        title={entry.address}
                      >
                        {t('address')}
                      </span>
                    )}
                    {entry.openingHours && (
                      <span
                        className="rounded-full border border-white/10 px-2 py-1"
                        title={entry.openingHours}
                      >
                        {t('hours')}
                      </span>
                    )}
                  </span>
                </span>
                <span className="glow flex h-9 shrink-0 items-center gap-1 rounded-xl bg-accent px-3 text-xs font-semibold text-white transition group-hover:brightness-110">
                  <span className="sr-only">{t('viewProfile')}</span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  >
                    <path d="M5 12h14m-6-6l6 6-6 6" />
                  </svg>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
