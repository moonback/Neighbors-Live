import { createClient } from '@supabase/supabase-js';
import type { Database } from '@nl/shared';
import { clientEnv } from '@/lib/env';
import { serverEnv } from '@/lib/env.server';

let admin: ReturnType<typeof createClient<Database>> | undefined;

/**
 * Service-role client: bypasses RLS. Only for route handlers / server components, always with
 * an actor resolved from the verified session and passed explicitly to SQL functions.
 */
export function adminClient() {
  admin ??= createClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  return admin;
}

export const SIGNED_URL_TTL_S = 600;
