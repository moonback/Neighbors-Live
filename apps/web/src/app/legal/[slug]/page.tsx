import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

const SLUGS = ['confidentialite', 'conditions', 'regles', 'contact'] as const;
type Slug = (typeof SLUGS)[number];
const isSlug = (s: string): s is Slug => (SLUGS as readonly string[]).includes(s);

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  if (!isSlug(slug)) return {};
  return { title: (await getTranslations('legal'))(`pages.${slug}.title`) };
}

export default async function LegalPage({ params }: Params) {
  const { slug } = await params;
  if (!isSlug(slug)) notFound();
  const t = await getTranslations('legal');
  const tf = await getTranslations('common.footer');
  const sections = t.raw(`pages.${slug}.sections`) as Array<{ title: string; body: string }>;
  return (
    <main id="main" className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <Link href="/" className="text-sm text-fog underline">
        ← Neighbors Live
      </Link>
      <h1 className="text-3xl font-bold">{t(`pages.${slug}.title`)}</h1>
      <p
        role="note"
        className="rounded-xl border border-amber-500 bg-amber-500/10 px-4 py-3 text-sm"
      >
        {t('draft')}
      </p>
      {sections.map((s) => (
        <section key={s.title} className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">{s.title}</h2>
          <p className="leading-relaxed text-fog">{s.body}</p>
        </section>
      ))}
      <p className="text-xs text-fog">{t('updated')}</p>
      <nav className="flex flex-wrap gap-4 border-t border-line pt-4 text-sm">
        <Link href="/legal/confidentialite">{tf('privacy')}</Link>
        <Link href="/legal/conditions">{tf('terms')}</Link>
        <Link href="/legal/regles">{tf('rules')}</Link>
        <Link href="/legal/contact">{tf('contact')}</Link>
      </nav>
    </main>
  );
}
