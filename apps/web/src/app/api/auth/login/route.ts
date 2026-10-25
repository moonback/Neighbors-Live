import { signInSchema } from '@nl/shared';
import { ApiError, json, parseBody, route } from '@/lib/api';
import { limitAuthAttempt } from '@/lib/auth-limits';
import { ONBOARDED_COOKIE } from '@/lib/onboarding';
import { createClient } from '@/lib/supabase/server';

/** E-mail + password sign-in; session cookies are set by the Supabase SSR client. */
export const POST = route(async (req) => {
  const { email, password } = await parseBody(req, signInSchema);
  await limitAuthAttempt(req, email);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    if (error?.status === 429) throw new ApiError('rate_limited', 429);
    if (error?.code === 'email_not_confirmed') throw new ApiError('email_not_confirmed', 403);
    throw new ApiError('invalid_credentials', 401);
  }
  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from('profiles').select('username').eq('id', data.user.id).single(),
    supabase.from('user_settings').select('onboarded_at').eq('user_id', data.user.id).single(),
  ]);
  const res = json({ ok: true, needsUsername: !profile?.username });
  // An account already onboarded elsewhere skips the onboarding on this device.
  if (settings?.onboarded_at) {
    res.cookies.set(ONBOARDED_COOKIE, '1', { path: '/', maxAge: 31_536_000, sameSite: 'lax' });
  }
  return res;
});
