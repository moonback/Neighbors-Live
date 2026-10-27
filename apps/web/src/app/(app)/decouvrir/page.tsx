import { CATEGORIES } from '@nl/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CategoryIcon } from '@/components/CategoryIcon';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('discover'))('title') };
}

export default async function DiscoverPage() {
  const t = await getTranslations('discover');
  const tc = await getTranslations('common');

  return (
    <div className="discover-page min-h-[calc(100dvh-3.5rem)] px-4 py-5 sm:px-8 sm:py-8 lg:py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:gap-10">
        <header className="discover-hero relative overflow-hidden rounded-[2rem] border border-line bg-panel p-6 sm:p-10 lg:p-14">
          <div className="discover-orbit" aria-hidden="true">
            <span />
            <span />
            <span />
            <span className="discover-orbit-pin">
              <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor">
                <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1116 0z" strokeWidth="1.5" />
                <circle cx="12" cy="10" r="2.5" strokeWidth="1.5" />
              </svg>
            </span>
          </div>
          <div className="relative z-10 max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-bold tracking-wide text-blue">
              <span className="h-1.5 w-1.5 rounded-full bg-blue" />
              {tc('slogan')}
            </p>
            <h1 className="mt-5 max-w-xl text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              {t('title')}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-fog sm:text-lg">
              {t('intro')}
            </p>
          </div>
        </header>

        <section aria-labelledby="discover-categories" className="flex flex-col gap-4 sm:gap-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-blue uppercase">
                {tc('appName')}
              </p>
              <h2 id="discover-categories" className="mt-1 text-2xl font-bold tracking-tight">
                {t('categoriesTitle')}
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4">
            {CATEGORIES.map((category) => (
              <Link
                key={category}
                href={`/?category=${category}`}
                className="discover-category group flex min-h-32 flex-col justify-between rounded-3xl border border-line bg-panel p-4 transition duration-200 hover:-translate-y-1 hover:border-accent/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:min-h-36 sm:p-5"
              >
                <span className="discover-category-icon flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-blue transition group-hover:scale-105">
                  <CategoryIcon category={category} className="h-5 w-5" />
                </span>
                <span className="mt-5 flex items-center justify-between gap-2 font-semibold">
                  <span>{tc(`categories.${category}`)}</span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className="h-4 w-4 shrink-0 text-fog transition group-hover:translate-x-1 group-hover:text-blue"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M3.5 10h13m-5-5 5 5-5 5" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </section>

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
