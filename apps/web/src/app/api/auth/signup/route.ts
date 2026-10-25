import { signUpSchema } from '@nl/shared';
import { ApiError, json, parseBody, route } from '@/lib/api';
import { limitAuthAttempt } from '@/lib/auth-limits';
import { clientEnv } from '@/lib/env';
import { adminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * Sign-up with e-mail, password and pseudo. When e-mail confirmation is enabled on the
 * Supabase project, no session is returned and the user must click the confirmation link.
 */
export const POST = route(async (req) => {
  const { email, password, username } = await parseBody(req, signUpSchema);
  await limitAuthAttempt(req, email);
  const admin = adminClient();

  const { data: taken } = await admin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (taken) throw new ApiError('username_taken', 409);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: new URL('/auth/callback', clientEnv.NEXT_PUBLIC_SITE_URL).toString(),
    },
  });
  if (error) {
    if (error.status === 429) throw new ApiError('rate_limited', 429);
    if (error.code === 'weak_password') throw new ApiError('password_too_weak', 422);
    // Same answer whether or not the address exists (no account enumeration).
    throw new ApiError('signup_failed', 400);
  }
  if (!data.user) throw new ApiError('signup_failed', 400);

  // Trusted server-side write: the user id comes from the Auth server response.
  const { error: nameError } = await admin
    .from('profiles')
    .update({ username })
    .eq('id', data.user.id)
    .is('username', null);
  if (nameError?.code === '23505') throw new ApiError('username_taken', 409);

  return json({ ok: true, needsConfirmation: data.session === null }, 201);
});
