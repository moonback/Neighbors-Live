import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ExploreSpotlightGrid } from '@/components/feed/ExploreSpotlightGrid';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('discover'))('title') };
}

export default async function DiscoverPage() {
  const t = await getTranslations('discover');

  return (
    <div className="discover-page min-h-[calc(100dvh-3.5rem)] px-4 py-5 sm:px-8 sm:py-8 lg:py-5">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:gap-10">
        <h1 className="sr-only">{t('title')}</h1>
        <ExploreSpotlightGrid />

        <section aria-label={t('nearbyTitle')} className="grid gap-4 lg:grid-cols-2">
          <Link
            href="/commerces/decouvrir"
            className="discover-feature discover-feature-shops group flex min-h-40 items-center justify-between gap-4 rounded-3xl border border-line bg-panel p-5 transition hover:-translate-y-1 hover:border-accent/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:p-7"
          >
            <span className="flex items-center gap-4">
              <span className="discover-feature-icon flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-blue">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-7 w-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                >
                  <path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0 2.7 2.7 0 005.3 0M10 20v-5h4v5" />
                </svg>
              </span>
              <span>
                <span className="block text-lg font-bold">{t('shopsTitle')}</span>
                <span className="mt-1 block max-w-md text-sm leading-relaxed text-fog">
                  {t('shopsBody')}
                </span>
              </span>
            </span>
            <span className="discover-feature-arrow flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-fog transition group-hover:translate-x-1 group-hover:text-blue">
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M3.5 10h13m-5-5 5 5-5 5" />
              </svg>
            </span>
          </Link>
          <Link
            href="/carte"
            className="discover-feature discover-feature-map group flex min-h-40 items-center justify-between gap-4 rounded-3xl border border-line bg-panel p-5 transition hover:-translate-y-1 hover:border-accent/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:p-7"
          >
            <span className="flex items-center gap-4">
              <span className="discover-feature-icon flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue/15 text-blue">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-7 w-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                >
                  <path d="M3 6.5l6-3 6 3 6-3v17l-6 3-6-3-6 3zM9 3.5v17m6-14v17" />
                </svg>
              </span>
              <span>
                <span className="block text-lg font-bold">{t('mapTitle')}</span>
                <span className="mt-1 block max-w-md text-sm leading-relaxed text-fog">
                  {t('mapBody')}
                </span>
              </span>
            </span>
            <span className="discover-feature-arrow flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-fog transition group-hover:translate-x-1 group-hover:text-blue">
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M3.5 10h13m-5-5 5 5-5 5" />
              </svg>
            </span>
          </Link>
        </section>
      </div>
    </div>
  );
}
