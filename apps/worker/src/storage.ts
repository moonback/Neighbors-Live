import { groupByBucket } from '@nl/shared';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { WorkerEnv } from './env.ts';

export { RAW_BUCKET, VIDEO_BUCKET, bucketFor, isProtected } from '@nl/shared';

export const storageClient = (env: WorkerEnv): SupabaseClient =>
  createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/** Deletes files grouped by bucket; missing files are not an error. */
export async function removePaths(client: SupabaseClient, paths: string[]): Promise<void> {
  for (const [bucket, list] of groupByBucket(paths)) {
    const { error } = await client.storage.from(bucket).remove(list);
    if (error) throw new Error(`storage remove ${bucket}: ${error.message}`);
  }
}
