import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { hydrate, type PublicVideoRow } from '@/lib/feed';
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
            className="aspect-[9/16] w-full rounded-2xl bg-black object-cover"
          />
          <p className="text-sm font-semibold">{tc(`categories.${item.category}`)}</p>
          {item.caption && <p className="text-lg">{item.caption}</p>}
          <p className="text-sm text-fog">{t('by', { username: item.author.username ?? '' })}</p>
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
