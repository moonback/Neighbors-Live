import { z } from 'zod';
import { ApiError, json, route, unwrap } from '@/lib/api';
import { hydrate, type PublicVideoRow } from '@/lib/feed';
import { createClient } from '@/lib/supabase/server';
import { adminClient } from '@/lib/supabase/admin';

/** One public video (deep links, map preview, refresh of expired signed URLs). */
export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const id = z.uuid().parse((await params).id);
  const rows = unwrap(await adminClient().rpc('get_public_video', { p_id: id }));
  if (!rows?.length) throw new ApiError('not_found', 404);
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (user) {
    const { data: hidden, error } = await supabase
      .from('hidden_videos')
      .select('video_id')
      .eq('user_id', user.id)
      .eq('video_id', id)
      .maybeSingle();
    if (error) unwrap({ data: null, error });
    if (hidden) throw new ApiError('not_found', 404);
  }
  const [item] = await hydrate(rows as PublicVideoRow[], user?.id ?? null);
  return json(item);
});
