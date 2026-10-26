import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
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
  const format = await getFormatter();
  const { data: merchant, error: merchantError } = await supabase
    .from('merchant_profiles')
    .select('business_name, status, created_at')
    .eq('user_id', viewer.id)
    .maybeSingle();
  const quota = merchant?.status === 'approved' ? await merchantQuota(viewer.id) : null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 pb-8 sm:p-6">
      <header className="flex flex-col gap-4 rounded-3xl border border-line bg-panel p-5 sm:flex-row sm:items-end sm:justify-between sm:p-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Voisino</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{t('title')}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fog">{t('intro')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/commerces"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-line px-4 text-sm font-semibold hover:border-accent"
          >
            {t('learnMore')}
          </Link>
          <Link
            href="/commerces/decouvrir"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-line px-4 text-sm font-semibold hover:border-accent"
          >
            {t('landing.directory.link')}
          </Link>
        </div>
      </header>
      <Card className="flex max-w-3xl flex-col gap-3">
        {merchantError && <Notice kind="error">{t('loadError')}</Notice>}
        {!merchant && !merchantError && (
          <>
            <h2 className="text-lg font-semibold">{t('apply')}</h2>
            <MerchantForm />
          </>
        )}
        {merchant?.status === 'pending' && (
          <div className="flex flex-col gap-2">
            <Notice>{t('pending')}</Notice>
            <p className="text-sm text-fog">
              {t('requestReceived', {
                date: format.dateTime(new Date(merchant.created_at), {
                  dateStyle: 'long',
                  timeStyle: 'short',
                }),
              })}
            </p>
            <p className="text-sm text-fog">{t('pendingDetails')}</p>
          </div>
        )}
        {merchant?.status === 'rejected' && (
          <div className="flex flex-col gap-2">
            <Notice kind="error">{t('rejected')}</Notice>
            <p className="text-sm text-fog">{t('rejectedDetails')}</p>
            <Link href="/commerces" className="w-fit text-sm font-semibold text-accent underline">
              {t('learnMore')}
            </Link>
          </div>
        )}
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
