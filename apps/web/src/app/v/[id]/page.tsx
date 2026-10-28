import type { Metadata } from 'next';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { hydrate, type PublicVideoRow } from '@/lib/feed';
import { getOfferStatus } from '@/lib/offer-status';
import { adminClient } from '@/lib/supabase/admin';

type Params = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const { data } = await adminClient().rpc('get_public_video', { p_id: id });
  if (!data?.length) return null;
  const [item] = await hydrate(data as PublicVideoRow[], null);
  return item ?? null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const item = await load((await params).id);
  const tc = await getTranslations('common');
  if (!item) return { title: tc('appName') };
  const category = tc(`categories.${item.category}`);
  return {
    title: `${category} — ${item.caption || tc('appName')}`,
    description: item.caption,
    openGraph: { title: category, description: item.caption, type: 'video.other' },
  };
}

/** Shareable deep link: public preview (fuzzed data only), then "open in the feed". */
export default async function VideoPage({ params }: Params) {
  const { id } = await params;
  const item = await load(id);
  const t = await getTranslations('video');
  const tc = await getTranslations('common');
  const format = await getFormatter();
  const now = new Date();
  const offerStatus = item
    ? getOfferStatus(item.category, item.author.isMerchant, item.expiresAt, 'active', now)
    : null;
  const hasMerchantWebsite = offerStatus === 'valid' && Boolean(item?.author.merchantWebsite);
  const hasMerchantPhone = item?.author.isMerchant && Boolean(item.author.merchantPhone);
  const hasMerchantAddress = item?.author.isMerchant && Boolean(item.author.merchantAddress);

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4">
      {!item ? (
        <p className="pt-10 text-center text-fog">{t('unavailable')}</p>
      ) : (
        <>
          <video
            src={item.videoUrl ?? undefined}
            poster={item.posterUrl ?? undefined}
            controls
            playsInline
            muted
            autoPlay
            loop
            aria-label={item.caption}
            className="aspect-[9/16] max-h-[70dvh] w-full rounded-2xl bg-black object-contain"
          />
          <p className="text-sm font-semibold">{tc(`categories.${item.category}`)}</p>
          {item.caption && <p className="text-lg">{item.caption}</p>}
          {item.category === 'shop' && (
            <div className="rounded-xl border border-white/10 bg-panel p-3 text-sm">
              <p className="font-semibold">{t('offerTermsLabel')}</p>
              <p className="mt-1 whitespace-pre-wrap text-fog">
                {item.offerTerms || t('offerTermsMissing')}
              </p>
            </div>
          )}
          <p className="text-sm text-fog">{t('by', { username: item.author.username ?? '' })}</p>
          {offerStatus && (
            <p
              role="status"
              className={`w-fit rounded-full px-3 py-1 text-sm font-semibold ${
                offerStatus === 'valid'
                  ? 'bg-green-800 text-white'
                  : offerStatus === 'expired'
                    ? 'bg-white/10 text-fog'
                    : 'bg-amber-300 text-ink'
              }`}
            >
              {offerStatus === 'valid'
                ? t('offerStatus.valid', {
                    when: format.relativeTime(new Date(item.expiresAt), now),
                  })
                : t(`offerStatus.${offerStatus}`)}
            </p>
          )}
          {(hasMerchantWebsite || hasMerchantPhone || hasMerchantAddress) && (
            <div className="flex flex-wrap gap-2">
              {hasMerchantWebsite && (
                <a
                  href={item.author.merchantWebsite!}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-panel px-4 text-sm font-semibold text-white"
                >
                  {t('offerView')}
                </a>
              )}
              {hasMerchantPhone && (
                <a
                  href={`tel:${item.author.merchantPhone!}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-panel px-4 text-sm font-semibold text-white"
                >
                  {t('callBusiness')}
                </a>
              )}
              {hasMerchantAddress && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.author.merchantAddress!)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-panel px-4 text-sm font-semibold text-white"
                >
                  {t('directions')}
                </a>
              )}
            </div>
          )}
        </>
      )}
      <Link
        href={item ? `/?video=${item.id}` : '/'}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 font-semibold text-ink"
      >
        {t('openFeed')}
      </Link>
    </main>
  );
}
