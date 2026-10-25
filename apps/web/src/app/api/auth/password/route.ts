import { passwordSchema } from '@nl/shared';
import { z } from 'zod';
import { ApiError, json, parseBody, requireUser, route } from '@/lib/api';
import { createClient } from '@/lib/supabase/server';

/** Sets a new password for the signed-in user (after a reset link, or from the settings). */
export const POST = route(async (req) => {
  await requireUser();
  const { password } = await parseBody(req, z.object({ password: passwordSchema }));
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === 'same_password') throw new ApiError('same_password', 422);
    if (error.code === 'weak_password') throw new ApiError('password_too_weak', 422);
    throw new ApiError('password_update_failed', 400);
  }
  return json({ ok: true });
});
