import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui';

type Step = { title: string; body: string };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('merchant.landing');
  return { title: t('title'), description: t('intro') };
}

export default async function MerchantLandingPage() {
  const t = await getTranslations('merchant.landing');
  const steps = t.raw('steps') as Step[];
  const details = t.raw('details') as string[];

  return (
    <main id="main" className="min-h-dvh bg-ink px-5 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-semibold text-fog hover:text-white">
            {t('back')}
          </Link>
        </header>

        <section className="grid gap-8 rounded-3xl border border-line bg-panel p-6 sm:p-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="flex flex-col items-start gap-5">
            <p className="rounded-full border border-accent/50 bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">
              {t('eyebrow')}
            </p>
            <h1 className="max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">{t('title')}</h1>
            <p className="max-w-2xl text-lg leading-relaxed text-fog">{t('intro')}</p>
            <Link
              href="/commerce"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-accent px-6 font-bold text-ink hover:bg-yellow-300"
            >
              {t('apply')}
            </Link>
          </div>
          <div className="flex min-h-56 flex-col justify-between rounded-2xl border border-line bg-ink p-5 sm:min-h-64 sm:p-7">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">
              Neighbors Live
            </p>
            <p className="text-2xl font-semibold leading-snug">{t('closing')}</p>
            <p className="text-sm text-fog">{t('eyebrow')}</p>
          </div>
        </section>

        <section aria-labelledby="merchant-steps-title" className="flex flex-col gap-5">
          <h2 id="merchant-steps-title" className="text-2xl font-bold sm:text-3xl">
            {t('howTitle')}
          </h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title}>
                <Card className="h-full">
                  <p className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-accent font-bold text-ink">
                    {index + 1}
                  </p>
                  <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-fog">{step.body}</p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-6 rounded-3xl border border-line p-6 sm:grid-cols-[0.8fr_1.2fr] sm:p-8">
          <div>
            <h2 className="text-2xl font-bold">{t('detailsTitle')}</h2>
            <p className="mt-3 text-sm leading-relaxed text-fog">{t('closing')}</p>
          </div>
          <ul className="flex flex-col gap-3">
            {details.map((detail) => (
              <li key={detail} className="flex items-start gap-3 text-sm leading-relaxed">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
                  aria-hidden="true"
                />
                <span>{detail}</span>
              </li>
            ))}
          </ul>
        </section>

        <footer className="flex flex-col items-start justify-between gap-4 border-t border-line pt-6 sm:flex-row sm:items-center">
          <p className="max-w-xl text-sm leading-relaxed text-fog">{t('closing')}</p>
          <Link
            href="/commerce"
            className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-accent px-6 font-bold text-ink hover:bg-yellow-300"
          >
            {t('apply')}
          </Link>
        </footer>
      </div>
    </main>
  );
}
