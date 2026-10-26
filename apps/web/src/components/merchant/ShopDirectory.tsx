'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/Avatar';

interface Entry {
  username: string;
  color: string;
  name: string;
  description: string;
}

export function ShopDirectory({ entries }: { entries: Entry[] }) {
  const t = useTranslations('merchant.landing.directory');
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () =>
      entries.filter((entry) =>
        `${entry.name} ${entry.description}`.toLocaleLowerCase().includes(normalizedQuery),
      ),
    [entries, normalizedQuery],
  );

  return (
    <section aria-labelledby="shop-directory-title" className="flex flex-col gap-4">
      <h2 id="shop-directory-title" className="sr-only">
        {t('title')}
      </h2>
      <label className="flex flex-col gap-2 text-sm font-semibold">
        {t('searchLabel')}
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('searchPlaceholder')}
          className="min-h-12 rounded-xl border border-line bg-panel px-4 font-normal text-white placeholder:text-fog focus:border-accent focus:outline-none"
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
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => (
            <li key={entry.username}>
              <article className="flex h-full flex-col gap-4 rounded-2xl border border-line bg-panel p-4 transition-colors hover:border-accent/60">
                <div className="flex items-center gap-3">
                  <Avatar username={entry.name} color={entry.color} size={48} />
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{entry.name}</h3>
                    <p className="text-sm text-fog">@{entry.username}</p>
                  </div>
                </div>
                <p className="flex-1 text-sm leading-relaxed text-fog">
                  {entry.description || t('noDescription')}
                </p>
                <Link
                  href={`/u/${encodeURIComponent(entry.username)}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-4 text-sm font-semibold hover:border-accent"
                >
                  {t('viewProfile')}
                </Link>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
