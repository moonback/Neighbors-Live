import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { MerchantForm } from '@/components/merchant/MerchantForm';
import { Card, Notice } from '@/components/ui';
import { getViewer } from '@/lib/session';
import { adminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('merchant'))('title') };
}

async function merchantQuota(userId: string) {
  const admin = adminClient();
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const [{ count }, own, config] = await Promise.all([
    admin
      .from('videos')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', userId)
      .eq('is_merchant', true)
      .gt('created_at', since),
    admin.from('merchant_profiles').select('daily_quota').eq('user_id', userId).single(),
    admin.from('app_config').select('value').eq('key', 'merchant_daily_quota').single(),
  ]);
  return { used: count ?? 0, quota: own.data?.daily_quota ?? Number(config.data?.value ?? 3) };
}

export default async function MerchantPage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/commerce');
  const supabase = await createClient();
  const t = await getTranslations('merchant');
  const { data: merchant } = await supabase
    .from('merchant_profiles')
    .select('business_name, status')
    .eq('user_id', viewer.id)
    .maybeSingle();
  const quota = merchant?.status === 'approved' ? await merchantQuota(viewer.id) : null;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <h1 className="pt-4 text-2xl font-bold">{t('title')}</h1>
      <p className="text-fog">{t('intro')}</p>
      <Card className="flex flex-col gap-3">
        {!merchant && (
          <>
            <h2 className="text-lg font-semibold">{t('apply')}</h2>
            <MerchantForm />
          </>
        )}
        {merchant?.status === 'pending' && <Notice>{t('pending')}</Notice>}
        {merchant?.status === 'rejected' && <Notice kind="error">{t('rejected')}</Notice>}
        {merchant?.status === 'approved' && quota && (
          <>
            <Notice kind="success">
              {t('approved')} — {merchant.business_name}
            </Notice>
            <p>{t('quota', quota)}</p>
            <p className="text-sm text-fog">{t('rules')}</p>
            {quota.used < quota.quota && (
              <Link
                href="/filmer"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 font-semibold text-ink"
              >
                {t('publish')}
              </Link>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
