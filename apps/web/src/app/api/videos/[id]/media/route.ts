import { z } from 'zod';
import { ApiError, json, route, unwrap } from '@/lib/api';
import { hydrate, type PublicVideoRow } from '@/lib/feed';
import { adminClient } from '@/lib/supabase/admin';
import { getUser } from '@/lib/supabase/server';

/** One public video (deep links, map preview, refresh of expired signed URLs). */
export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const id = z.uuid().parse((await params).id);
  const rows = unwrap(await adminClient().rpc('get_public_video', { p_id: id }));
  if (!rows?.length) throw new ApiError('not_found', 404);
  const user = await getUser();
  const [item] = await hydrate(rows as PublicVideoRow[], user?.id ?? null);
  return json(item);
});
