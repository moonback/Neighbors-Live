'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@nl/shared';
import { clientEnv } from '@/lib/env';

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function browserClient() {
  client ??= createBrowserClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return client;
}
