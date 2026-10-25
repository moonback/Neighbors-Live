import { groupByBucket } from '@nl/shared';
import { z } from 'zod';
import { json, requireUser, route, unwrap } from '@/lib/api';
import { adminClient } from '@/lib/supabase/admin';

const idSchema = z.uuid();

/** Immediate withdrawal by the author: row deleted, files removed now (purge job as backup). */
export const DELETE = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const user = await requireUser();
  const id = idSchema.parse((await params).id);
  const admin = adminClient();
  const paths = unwrap(await admin.rpc('withdraw_video', { p_user: user.id, p_video: id })) ?? [];
  for (const [bucket, list] of groupByBucket(paths)) {
    const { error } = await admin.storage.from(bucket).remove(list);
    if (error) console.error('withdraw: storage removal deferred to purge job', error.message);
  }
  return json({ ok: true });
});
