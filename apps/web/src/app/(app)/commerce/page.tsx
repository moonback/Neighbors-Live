import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { MerchantDashboard } from '@/components/merchant/MerchantDashboard';
import { MerchantForm } from '@/components/merchant/MerchantForm';
import { Card, Notice } from '@/components/ui';
import { loadMerchantDashboard } from '@/lib/merchant-dashboard.server';
import { getViewer } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('merchant'))('title') };
}

export default async function MerchantPage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/commerce');
  const supabase = await createClient();
  const t = await getTranslations('merchant');
  const format = await getFormatter();
  const { data: merchant, error: merchantError } = await supabase
    .from('merchant_profiles')
    .select(
      'business_name, description, status, created_at, website, phone, address, opening_hours',
    )
    .eq('user_id', viewer.id)
    .maybeSingle();
  const dashboard = merchant?.status === 'approved' ? await loadMerchantDashboard(viewer.id) : null;

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
        {merchant?.status === 'approved' && dashboard && (
          <>
            <Notice kind="success">
              {t('approved')} — {merchant.business_name}
            </Notice>
            <div className="flex flex-wrap gap-2 text-sm text-fog">
              {merchant.website && (
                <a
                  href={merchant.website}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-line px-2 py-1 font-medium text-white hover:border-accent"
                >
                  {t('website')}
                </a>
              )}
              {merchant.phone && (
                <a
                  href={`tel:${merchant.phone}`}
                  className="rounded-full border border-line px-2 py-1 font-medium text-white hover:border-accent"
                >
                  {t('phone')}
                </a>
              )}
              {merchant.address && (
                <span className="rounded-full border border-line px-2 py-1 font-medium text-white">
                  {merchant.address}
                </span>
              )}
              {merchant.opening_hours && (
                <span className="rounded-full border border-line px-2 py-1 font-medium text-white">
                  {merchant.opening_hours}
                </span>
              )}
            </div>
            <p className="text-sm text-fog">{t('rules')}</p>
          </>
        )}
      </Card>
      {dashboard && <MerchantDashboard initial={dashboard} />}
      {merchant?.status === 'approved' && (
        <Card className="flex max-w-3xl flex-col gap-3">
          <h2 className="text-lg font-semibold">{t('edit.title')}</h2>
          <p className="text-sm text-fog">{t('edit.description')}</p>
          <MerchantForm
            initial={{
              description: merchant.description,
              website: merchant.website,
              phone: merchant.phone,
              address: merchant.address,
              openingHours: merchant.opening_hours,
            }}
          />
        </Card>
      )}
    </div>
  );
}
