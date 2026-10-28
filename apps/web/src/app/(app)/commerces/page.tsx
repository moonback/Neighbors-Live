import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('merchant.landing');
  return { title: t('title'), description: t('intro') };
}

export default async function MerchantLandingPage() {
  const t = await getTranslations('merchant.landing');
  const steps = (t.raw('steps') as Array<{ title: string; body: string }>) ?? [];
  const details = (t.raw('details') as string[]) ?? [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 pb-8 sm:p-6">
      <header className="rounded-3xl border border-line bg-panel p-5 sm:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
              {t('eyebrow')}
            </p>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{t('title')}</h1>
            <p className="mt-3 text-sm leading-relaxed text-fog sm:text-base">{t('intro')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/commerce"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-4 text-sm font-semibold hover:border-accent"
            >
              {t('apply')}
            </Link>
            <Link
              href="/commerces/decouvrir"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-ink"
            >
              {t('directory.link')}
            </Link>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <Card className="p-5 sm:p-6">
          <h2 className="text-xl font-bold">{t('howTitle')}</h2>
          <ol className="mt-5 space-y-4">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-ink">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-fog">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="text-xl font-bold">{t('detailsTitle')}</h2>
          <ul className="mt-5 space-y-3 text-sm leading-relaxed text-fog">
            {details.map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="p-5 text-center sm:p-6">
        <p className="text-lg font-semibold">{t('closing')}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            href="/commerce"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-5 font-semibold text-ink"
          >
            {t('apply')}
          </Link>
          <Link
            href="/commerces/decouvrir"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-5 font-semibold hover:border-accent"
          >
            {t('directory.link')}
          </Link>
        </div>
      </Card>
    </div>
  );
}
