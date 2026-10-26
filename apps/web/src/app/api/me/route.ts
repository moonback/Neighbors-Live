import { groupByBucket } from '@nl/shared';
import { z } from 'zod';
import { ApiError, json, parseBody, requireUser, route, unwrap } from '@/lib/api';
import { adminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const schema = z.object({ confirm: z.string().min(1).max(40) });

/**
 * Account deletion: files are removed from storage right away (a purge job is also queued as a
 * safety net), then the auth user is deleted, which cascades to every row owned by the user.
 */
export const DELETE = route(async (req) => {
  const user = await requireUser();
  const { confirm } = await parseBody(req, schema);
  const admin = adminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('username, avatar_path, cover_path')
    .eq('id', user.id)
    .single();
  if (!profile || (profile.username ?? '') !== confirm.trim().toLowerCase()) {
    throw new ApiError('confirmation_mismatch', 422);
  }

  const paths = unwrap(await admin.rpc('prepare_account_deletion', { p_user: user.id })) ?? [];
  for (const [bucket, list] of groupByBucket(paths)) {
    const { error } = await admin.storage.from(bucket).remove(list);
    if (error) console.error('storage removal deferred to purge job', bucket, error.message);
  }
  const profileImages = [profile.avatar_path, profile.cover_path].filter(
    (path): path is string => path !== null,
  );
  if (profileImages.length) {
    const { error } = await admin.storage.from('profile-images').remove(profileImages);
    if (error)
      console.error('profile image removal deferred after account deletion', error.message);
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw new ApiError('internal', 500);
  const supabase = await createClient();
  await supabase.auth.signOut();
  return json({ ok: true, deletedFiles: paths.length });
});
