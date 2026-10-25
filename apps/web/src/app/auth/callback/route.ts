import { NextResponse, type NextRequest } from 'next/server';
import { clientEnv } from '@/lib/env';
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', data.user.id)
    .single();
  const target = profile?.username ? next : `/bienvenue?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(new URL(target, site));
}
