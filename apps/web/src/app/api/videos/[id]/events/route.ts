import { videoEventSchema } from '@nl/shared';
import { z } from 'zod';
import { ipKey, parseBody, route, unwrap } from '@/lib/api';
import { adminClient } from '@/lib/supabase/admin';
import { getUser } from '@/lib/supabase/server';

/**
 * Anonymous aggregate counter (view / offer action click) for merchant statistics. The SQL
 * function ignores the author and inactive videos; nothing identifying the viewer is stored.
 */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const id = z.uuid().parse((await params).id);
  const { kind } = await parseBody(req, videoEventSchema);
  const user = await getUser();
  unwrap(
    await adminClient().rpc('record_video_event', {
      p_video: id,
      p_kind: kind,
      p_rate_key: user?.id ?? ipKey(req),
      ...(user && { p_actor: user.id }),
    }),
  );
  return new Response(null, { status: 204 });
});
