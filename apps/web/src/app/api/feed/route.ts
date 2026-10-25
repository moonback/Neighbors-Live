import { decodeCursor, encodeCursor, feedQuerySchema } from '@nl/shared';
import { z } from 'zod';
import { ApiError, json, route, unwrap } from '@/lib/api';
import { hydrate, type PublicVideoRow } from '@/lib/feed';
import { adminClient } from '@/lib/supabase/admin';
import { getUser } from '@/lib/supabase/server';

const PAGE = 8;
const querySchema = feedQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

/**
 * Hyperlocal feed, cursor-paginated. The query position is used for this request only: it is
 * neither stored nor logged. Results carry fuzzed positions and 100 m distance buckets.
 */
export const GET = route(async (req) => {
  const q = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const cursor = q.cursor ? decodeCursor(q.cursor) : null;
  if (q.cursor && !cursor) throw new ApiError('invalid_input', 422);
  const ref = cursor?.ref ?? new Date().toISOString();
  const limit = q.limit ?? PAGE;

  const rows = unwrap(
    await adminClient().rpc('nearby_videos', {
      p_lat: q.lat,
      p_lng: q.lng,
      p_radius_m: q.radius,
      p_category: q.category,
      p_cursor_score: cursor?.score,
      p_cursor_id: cursor?.id,
      p_ref_time: ref,
      p_limit: limit,
    }),
  );
  const user = await getUser();
  const items = await hydrate(rows as PublicVideoRow[], user?.id ?? null);
  const last = rows.at(-1);
  const nextCursor =
    rows.length === limit && last ? encodeCursor({ score: last.score, id: last.id, ref }) : null;
  return json({ items, nextCursor });
});
