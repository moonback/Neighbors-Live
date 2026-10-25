import { CATEGORIES, type Category } from '@nl/shared';
import { z } from 'zod';
import { getTranslations } from 'next-intl/server';
import { Feed } from '@/components/feed/Feed';
import { getViewer } from '@/lib/session';

const params = z.object({
  video: z.uuid().optional().catch(undefined),
  category: z.enum(CATEGORIES).optional().catch(undefined),
  deleted: z.string().optional(),
});

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = params.parse(await searchParams);
  const [viewer, t] = await Promise.all([getViewer(), getTranslations('feed')]);
  return (
    <Feed
      initialRadius={viewer?.settings.defaultRadius ?? 1000}
      signedIn={Boolean(viewer?.username)}
      focusId={query.video ?? null}
      initialCategory={(query.category as Category | undefined) ?? null}
      notice={query.deleted ? t('deleted') : null}
    />
  );
}
