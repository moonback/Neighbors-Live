import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { buildCsp } from '@/lib/csp';
import { clientEnv } from '@/lib/env';
import { ONBOARDED_COOKIE } from '@/lib/onboarding';
/** App screens that first-time visitors only reach after the 4-screen onboarding. */
const GATED = /^\/(carte|me|u\/[^/]+|parametres|moderation|commerce|admin)?$/;

/** Refreshes the Supabase session cookies and sets a per-request CSP nonce. */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (GATED.test(pathname) && !request.cookies.has(ONBOARDED_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = '/onboarding';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV === 'development',
    supabaseUrl: clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    mapStyleUrl: clientEnv.NEXT_PUBLIC_MAP_STYLE_URL,
    siteUrl: clientEnv.NEXT_PUBLIC_SITE_URL,
  });

  const forward = () => {
    const headers = new Headers(request.headers);
    headers.set('x-nonce', nonce);
    headers.set('Content-Security-Policy', csp);
    headers.set('cookie', request.cookies.toString());
    return NextResponse.next({ request: { headers } });
  };

  let response = forward();
  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = forward();
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        },
      },
    },
  );
  // Revalidates and, if needed, refreshes the session; must run before any render.
  await supabase.auth.getUser();

  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|serwist/|icons/|manifest.webmanifest|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)',
  ],
};
