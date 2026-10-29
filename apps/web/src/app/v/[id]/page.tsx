import type { Metadata } from 'next';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { hydrate, type PublicVideoRow } from '@/lib/feed';
import { getOfferStatus } from '@/lib/offer-status';
import { adminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { Avatar } from '@/components/Avatar';
import { TrackedOfferLink, TrackOfferView } from '@/components/video/OfferTracking';
import { VideoPageInteractions } from '@/components/video/VideoPageInteractions';

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
  const supabase = item ? await createClient() : null;
  const { data: { user } = { user: null } } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };
  const offerStatus = item
    ? getOfferStatus(item.category, item.author.isMerchant, item.expiresAt, 'active', now)
    : null;
  const hasMerchantWebsite = offerStatus === 'valid' && Boolean(item?.author.merchantWebsite);
  const hasMerchantPhone = item?.author.isMerchant && Boolean(item.author.merchantPhone);
  const hasMerchantAddress = item?.author.isMerchant && Boolean(item.author.merchantAddress);

  return (
    <main id="main" className="min-h-dvh bg-[#101114] text-white">
      {!item ? (
        <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
          <p className="text-fog">{t('unavailable')}</p>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 font-semibold text-black"
          >
            {t('openFeed')}
          </Link>
        </div>
      ) : (
        <div className="mx-auto flex min-h-dvh max-w-[1440px] flex-col lg:flex-row">
          <section className="relative flex min-h-[72dvh] flex-1 items-center justify-center overflow-hidden bg-[#08090b] px-5 py-10 lg:sticky lg:top-0 lg:h-dvh lg:min-h-0">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-50"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 12% 18%, #ffffff 0.7px, transparent 1px), radial-gradient(circle at 76% 32%, #ffffff 0.8px, transparent 1.2px), radial-gradient(circle at 48% 78%, #ffffff 0.6px, transparent 1px), radial-gradient(circle at 91% 86%, #ffffff 0.7px, transparent 1.1px)',
                backgroundSize: '113px 127px, 173px 191px, 149px 167px, 211px 223px',
              }}
            />
            <div className="absolute left-5 top-5 z-10 rounded-full border border-white/15 bg-black/55 px-4 py-2 text-sm font-semibold backdrop-blur">
              @{item.author.username ?? t('publicPage.neighbor')}
            </div>
            <video
              src={item.videoUrl ?? undefined}
              poster={item.posterUrl ?? undefined}
              controls
              playsInline
              muted
              autoPlay
              loop
              aria-label={item.caption || tc(`categories.${item.category}`)}
              className="relative z-[1] max-h-[70dvh] w-auto max-w-full rounded-2xl bg-black object-contain shadow-2xl shadow-black/50 lg:max-h-[82dvh]"
              style={{ aspectRatio: item.orientation === 'portrait' ? '9 / 16' : '16 / 9' }}
            />
            <div className="absolute bottom-5 left-5 z-10 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 bg-black/60 px-3 py-2 text-sm backdrop-blur">
                <span aria-hidden="true" className="mr-2 text-emerald-400">
                  ●
                </span>
                {t('publicPage.nearby')}
              </span>
              <Link
                href={`/?video=${item.id}`}
                className="min-h-10 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur transition-colors hover:bg-white/20"
              >
                {t('openFeed')}
              </Link>
            </div>
          </section>

          <section className="flex w-full flex-col border-white/10 px-5 pb-8 pt-6 sm:px-8 lg:min-h-dvh lg:w-[440px] lg:shrink-0 lg:border-l lg:px-7">
            <header className="flex items-center gap-3 border-b border-white/10 pb-5">
              <Avatar
                username={item.author.username}
                color={item.author.color}
                src={item.author.avatarUrl}
                size={48}
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={
                    item.author.username ? `/u/${encodeURIComponent(item.author.username)}` : '/'
                  }
                  className="font-semibold hover:underline"
                >
                  @{item.author.username ?? t('publicPage.neighbor')}
                </Link>
                <p className="mt-1 text-xs text-fog">
                  {item.publishedAt
                    ? format.dateTime(new Date(item.publishedAt), {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : tc(`categories.${item.category}`)}
                </p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80">
                {tc(`categories.${item.category}`)}
              </span>
            </header>

            <div className="flex-1 py-5">
              {item.caption && (
                <p className="whitespace-pre-wrap break-words leading-7">{item.caption}</p>
              )}
              <p className="mt-4 text-sm text-fog">{t('publicPage.originalSound')}</p>
              <p className="mt-1 text-sm font-medium">{tc(`categories.${item.category}`)}</p>
              {offerStatus && (
                <p
                  role="status"
                  className={`mt-4 w-fit rounded-full px-3 py-1.5 text-sm font-semibold ${
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
              {item.category === 'shop' && item.author.isMerchant && (
                <TrackOfferView videoId={item.id} />
              )}
              {item.category === 'shop' && (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
                  <p className="font-semibold">{t('offerTermsLabel')}</p>
                  <p className="mt-1 whitespace-pre-wrap text-fog">
                    {item.offerTerms || t('offerTermsMissing')}
                  </p>
                </div>
              )}
              {(hasMerchantWebsite || hasMerchantPhone || hasMerchantAddress) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {hasMerchantWebsite && (
                    <TrackedOfferLink
                      videoId={item.id}
                      kind="offer_click"
                      href={item.author.merchantWebsite!}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold"
                    >
                      {t('offerView')}
                    </TrackedOfferLink>
                  )}
                  {hasMerchantPhone && (
                    <TrackedOfferLink
                      videoId={item.id}
                      kind="call_click"
                      href={`tel:${item.author.merchantPhone!}`}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold"
                    >
                      {t('callBusiness')}
                    </TrackedOfferLink>
                  )}
                  {hasMerchantAddress && (
                    <TrackedOfferLink
                      videoId={item.id}
                      kind="directions_click"
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.author.merchantAddress!)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold"
                    >
                      {t('directions')}
                    </TrackedOfferLink>
                  )}
                </div>
              )}
            </div>

            <VideoPageInteractions
              key={user ? 'signed-in' : 'signed-out'}
              item={item}
              signedIn={Boolean(user)}
              creatorHref={
                item.author.username ? `/u/${encodeURIComponent(item.author.username)}` : '/'
              }
            />
          </section>
        </div>
      )}
    </main>
  );
}
