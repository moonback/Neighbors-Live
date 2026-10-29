import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ShopDirectory } from '@/components/merchant/ShopDirectory';
import { Notice } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import { profileImageUrl } from '@/lib/profile-image';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('merchant.landing.directory');
  return { title: t('title'), description: t('intro') };
}

export default async function ShopDirectoryPage() {
  const t = await getTranslations('merchant.landing.directory');
  const supabase = await createClient();
  const merchants = await supabase
    .from('merchant_profiles')
    .select('user_id, business_name, description, website, phone, address, opening_hours')
    .eq('status', 'approved')
    .order('business_name')
    .limit(100);

  if (merchants.error) {
    return (
      <div className="px-4 py-8 sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <Link href="/commerces" className="w-fit text-sm font-semibold text-fog hover:text-white">
            {t('back')}
          </Link>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <Notice kind="error">{t('error')}</Notice>
        </div>
      </div>
    );
  }

  const profiles = merchants.data.length
    ? await supabase
        .from('profiles')
        .select('id, username, avatar_color, avatar_path')
        .in(
          'id',
          merchants.data.map((merchant) => merchant.user_id),
        )
    : { data: [], error: null };
  if (profiles.error) {
    return (
      <div className="px-4 py-8 sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <Link href="/commerces" className="w-fit text-sm font-semibold text-fog hover:text-white">
            {t('back')}
          </Link>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <Notice kind="error">{t('error')}</Notice>
        </div>
      </div>
    );
  }

  const usernames = new Map((profiles.data ?? []).map((profile) => [profile.id, profile.username]));
  const colors = new Map(
    (profiles.data ?? []).map((profile) => [profile.id, profile.avatar_color]),
  );
  const avatars = new Map(
    (profiles.data ?? []).map((profile) => [profile.id, profileImageUrl(profile.avatar_path)]),
  );
  const entries = merchants.data.flatMap((merchant) => {
    const username = usernames.get(merchant.user_id);
    if (!username) return [];
    return [
      {
        username,
        color: colors.get(merchant.user_id) ?? '#6b7280',
        avatarUrl: avatars.get(merchant.user_id) ?? null,
        name: merchant.business_name,
        description: merchant.description,
        website: merchant.website ?? null,
        phone: merchant.phone ?? null,
        address: merchant.address ?? null,
        openingHours: merchant.opening_hours ?? null,
      },
    ];
  });

  return (
    <div className="px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{t('title')}</h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-fog">{t('intro')}</p>
          </div>
          <Link
            href="/commerces"
            className="glass inline-flex min-h-11 shrink-0 items-center rounded-2xl px-4 text-sm font-semibold"
          >
            {t('forMerchants')}
          </Link>
        </header>
        <ShopDirectory entries={entries} />
      </div>
    </div>
  );
}
