import { emailSchema } from '@nl/shared';
import { z } from 'zod';
import { json, parseBody, route } from '@/lib/api';
import { limitAuthAttempt } from '@/lib/auth-limits';
import { clientEnv } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

/** Sends a password reset link. Always answers OK (no account enumeration). */
export const POST = route(async (req) => {
  const { email } = await parseBody(req, z.object({ email: emailSchema }));
  await limitAuthAttempt(req, email);
  const redirect = new URL('/auth/callback', clientEnv.NEXT_PUBLIC_SITE_URL);
  redirect.searchParams.set('next', '/reinitialiser');
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirect.toString(),
  });
  if (error) console.error('resetPasswordForEmail failed', error.message);
  return json({ ok: true });
});
