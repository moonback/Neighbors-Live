import { createServerClient } from '@supabase/ssr';
import type { Database } from '@nl/shared';
import { cookies } from 'next/headers';
import { clientEnv } from '@/lib/env';

/** Supabase client acting as the signed-in user (RLS applies). Server components & routes. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
          } catch {
            // Called from a Server Component: cookies are refreshed by src/proxy.ts instead.
          }
        },
      },
    },
  );
}

/** Verified current user (validated against the Auth server), or null. */
export async function getUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
