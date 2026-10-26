import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ShopDirectory } from '@/components/merchant/ShopDirectory';
import { Notice } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('merchant.landing.directory');
  return { title: t('title'), description: t('intro') };
}

export default async function ShopDirectoryPage() {
  const t = await getTranslations('merchant.landing.directory');
  const supabase = await createClient();
  const merchants = await supabase
    .from('merchant_profiles')
    .select('user_id, business_name, description')
    .eq('status', 'approved')
    .order('business_name')
    .limit(100);

  if (merchants.error) {
    return (
      <main id="main" className="min-h-dvh bg-ink px-4 py-8 sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <Link href="/commerces" className="w-fit text-sm font-semibold text-fog hover:text-white">
            {t('back')}
          </Link>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <Notice kind="error">{t('error')}</Notice>
        </div>
      </main>
    );
  }

  const profiles = merchants.data.length
    ? await supabase
        .from('profiles')
        .select('id, username, avatar_color')
        .in(
          'id',
          merchants.data.map((merchant) => merchant.user_id),
        )
    : { data: [], error: null };
  if (profiles.error) {
    return (
      <main id="main" className="min-h-dvh bg-ink px-4 py-8 sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <Link href="/commerces" className="w-fit text-sm font-semibold text-fog hover:text-white">
            {t('back')}
          </Link>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <Notice kind="error">{t('error')}</Notice>
        </div>
      </main>
    );
  }

  const usernames = new Map((profiles.data ?? []).map((profile) => [profile.id, profile.username]));
  const colors = new Map(
    (profiles.data ?? []).map((profile) => [profile.id, profile.avatar_color]),
  );
  const entries = merchants.data.flatMap((merchant) => {
    const username = usernames.get(merchant.user_id);
    if (!username) return [];
    return [
      {
        username,
        color: colors.get(merchant.user_id) ?? '#6b7280',
        name: merchant.business_name,
        description: merchant.description,
      },
    ];
  });

  return (
    <main id="main" className="min-h-dvh bg-ink px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/commerces" className="text-sm font-semibold text-fog hover:text-white">
            {t('back')}
          </Link>
          <Link
            href="/commerce"
            className="inline-flex min-h-11 items-center rounded-xl bg-accent px-4 font-semibold text-ink"
          >
            {t('forMerchants')}
          </Link>
        </header>
        <section className="rounded-3xl border border-line bg-panel p-5 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
            Neighbors Live
          </p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{t('title')}</h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-fog">{t('intro')}</p>
        </section>
        <ShopDirectory entries={entries} />
      </div>
    </main>
  );
}
