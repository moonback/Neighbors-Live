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
    <div className="min-h-[calc(100dvh-3.5rem)] px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">
            {tc('slogan')}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
          <p className="mt-3 text-base leading-relaxed text-fog">{t('intro')}</p>
        </header>

        <section aria-labelledby="discover-categories" className="flex flex-col gap-4">
          <h2 id="discover-categories" className="text-xl font-semibold">
            {t('categoriesTitle')}
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            {CATEGORIES.map((category) => (
              <Link
                key={category}
                href={`/?category=${category}`}
                className="group flex min-h-20 flex-col justify-between rounded-2xl border border-line bg-panel p-3 transition hover:border-accent/60 hover:bg-panel/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
                  <CategoryIcon category={category} className="h-4 w-4" />
                </span>
                <span className="mt-2 font-semibold">{tc(`categories.${category}`)}</span>
              </Link>
            ))}
          </div>
        </section>

        <section aria-label={t('nearbyTitle')} className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/commerces/decouvrir"
            className="flex min-h-28 flex-col justify-center rounded-2xl border border-line bg-panel p-5 transition hover:border-accent/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="font-semibold">{t('shopsTitle')}</span>
            <span className="mt-1 text-sm text-fog">{t('shopsBody')}</span>
          </Link>
          <Link
            href="/carte"
            className="flex min-h-28 flex-col justify-center rounded-2xl border border-line bg-panel p-5 transition hover:border-accent/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="font-semibold">{t('mapTitle')}</span>
            <span className="mt-1 text-sm text-fog">{t('mapBody')}</span>
          </Link>
        </section>
      </div>
    </div>
  );
}
