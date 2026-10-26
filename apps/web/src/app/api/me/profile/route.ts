import { profileUpdateSchema } from '@nl/shared';
import { z } from 'zod';
import { ApiError, json, parseBody, requireUser, route, unwrap } from '@/lib/api';
import { adminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const imagePath = z
  .string()
  .max(120)
  .regex(/^[0-9a-f-]{36}\/(avatar|cover)\/[0-9a-f-]{36}\.(jpg|png|webp)$/i);
const schema = profileUpdateSchema.pick({ username: true, bio: true }).extend({
  avatarPath: imagePath.nullable().optional(),
  coverPath: imagePath.nullable().optional(),
});

/** Owner updates their public profile; RLS and column grants restrict editable fields. */
export const PATCH = route(async (req) => {
  const user = await requireUser();
  const patch = await parseBody(req, schema);
  for (const path of [patch.avatarPath, patch.coverPath]) {
    if (path && !path.startsWith(`${user.id}/`)) throw new ApiError('invalid_input', 422);
  }

  const admin = adminClient();
  const previous = unwrap<{ avatar_path: string | null; cover_path: string | null }>(
    await admin.from('profiles').select('avatar_path, cover_path').eq('id', user.id).single(),
  );
  const { avatarPath, coverPath, ...textPatch } = patch;
  const dbPatch = {
    ...textPatch,
    ...(avatarPath !== undefined ? { avatar_path: avatarPath } : {}),
    ...(coverPath !== undefined ? { cover_path: coverPath } : {}),
  };
  const supabase = await createClient();
  const updated = unwrap(
    await supabase
      .from('profiles')
      .update(dbPatch)
      .eq('id', user.id)
      .select('username, bio, avatar_path, cover_path')
      .single(),
  );
  const obsolete = [
    avatarPath !== undefined && previous.avatar_path !== avatarPath ? previous.avatar_path : null,
    coverPath !== undefined && previous.cover_path !== coverPath ? previous.cover_path : null,
  ].filter((path): path is string => path !== null);
  if (obsolete.length) {
    const { error } = await admin.storage.from('profile-images').remove(obsolete);
    if (error) console.error('profile image cleanup failed', error.message);
  }
  return json(updated);
});
