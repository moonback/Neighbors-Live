import { z } from 'zod';
import { ApiError, hashKey, ipKey, json, parseBody, route, unwrap } from '@/lib/api';
import { clientEnv } from '@/lib/env';
import { safeNext } from '@/lib/redirect';
import { adminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const schema = z.object({
  email: z.email().max(254),
  next: z.string().max(200).optional(),
});

export const POST = route(async (req) => {
  const { email, next } = await parseBody(req, schema);
  const admin = adminClient();
  // Per IP and per address; both keys are salted hashes, never the raw values.
  unwrap(await admin.rpc('check_rate_limit', { p_key: ipKey(req), p_rule: 'login' }));
  unwrap(
    await admin.rpc('check_rate_limit', {
      p_key: hashKey(`email:${email.toLowerCase()}`),
      p_rule: 'login',
    }),
  );

  const redirect = new URL('/auth/callback', clientEnv.NEXT_PUBLIC_SITE_URL);
  redirect.searchParams.set('next', safeNext(next));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirect.toString(), shouldCreateUser: true },
  });
  if (error) {
    if (error.status === 429) throw new ApiError('rate_limited', 429);
    console.error('signInWithOtp failed', error.message);
    throw new ApiError('auth_failed', 400);
  }
  return json({ ok: true });
});
