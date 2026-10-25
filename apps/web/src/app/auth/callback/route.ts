import { NextResponse, type NextRequest } from 'next/server';
import { clientEnv } from '@/lib/env';
import { ONBOARDED_COOKIE } from '@/lib/onboarding';
import { safeNext } from '@/lib/redirect';
import { createClient } from '@/lib/supabase/server';

/** Magic link landing: exchanges the PKCE code for a session, then routes the new user. */
export async function GET(req: NextRequest) {
  const site = clientEnv.NEXT_PUBLIC_SITE_URL;
  const code = req.nextUrl.searchParams.get('code');
  const next = safeNext(req.nextUrl.searchParams.get('next'));
  if (!code) return NextResponse.redirect(new URL('/login?error=callback', site));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL('/login?error=callback', site));

  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from('profiles').select('username').eq('id', data.user.id).single(),
    supabase.from('user_settings').select('onboarded_at').eq('user_id', data.user.id).single(),
  ]);
  const target = profile?.username ? next : `/bienvenue?next=${encodeURIComponent(next)}`;
  const res = NextResponse.redirect(new URL(target, site));
  // An account already onboarded elsewhere skips the onboarding on this new device.
  if (settings?.onboarded_at) {
    res.cookies.set(ONBOARDED_COOKIE, '1', { path: '/', maxAge: 31_536_000, sameSite: 'lax' });
  }
  return res;
}
