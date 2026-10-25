import { z } from 'zod';
import { ApiError, json, requireUser, route, unwrap } from '@/lib/api';
import { createClient } from '@/lib/supabase/server';

/** The author deletes their own comment (RLS: comments_delete_own). */
export const DELETE = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const user = await requireUser();
  const id = z.uuid().parse((await params).id);
  const supabase = await createClient();
  const deleted = unwrap(
    await supabase.from('comments').delete().eq('id', id).eq('author_id', user.id).select('id'),
  );
  if (deleted.length === 0) throw new ApiError('not_found', 404);
  return json({ ok: true });
});
