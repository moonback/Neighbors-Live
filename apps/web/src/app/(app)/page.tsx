import { CATEGORIES, RADII_M, type Category } from '@nl/shared';
import { z } from 'zod';
import { getTranslations } from 'next-intl/server';
import { Feed } from '@/components/feed/Feed';
import { getViewer } from '@/lib/session';

const params = z.object({
  video: z.uuid().optional().catch(undefined),
  category: z.enum(CATEGORIES).optional().catch(undefined),
  radius: z
    .preprocess(
      (value) => (typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value),
      z.number().refine((value) => RADII_M.some((radius) => radius === value)),
    )
    .optional()
    .catch(undefined),
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
      initialRadius={query.radius ?? viewer?.settings.defaultRadius ?? 1000}
      signedIn={Boolean(viewer?.username)}
      focusId={query.video ?? null}
      initialCategory={(query.category as Category | undefined) ?? null}
      notice={query.deleted ? t('deleted') : null}
    />
  );
}
