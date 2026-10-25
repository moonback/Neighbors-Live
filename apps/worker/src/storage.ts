import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { WorkerEnv } from './env.ts';

export const RAW_BUCKET = 'raw-videos';
export const VIDEO_BUCKET = 'videos';

/** Raw uploads are stored as `<user uuid>/<video uuid>.<ext>`; processed files as `<video uuid>.mp4|jpg`. */
const RAW_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]+$/;

export function bucketFor(path: string): string {
  return RAW_PATH.test(path) ? RAW_BUCKET : VIDEO_BUCKET;
}

/** Demo clips are shared by every seeded video and must never be purged. */
export const isProtected = (path: string): boolean => path.startsWith('demo/');

export const storageClient = (env: WorkerEnv): SupabaseClient =>
  createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/** Deletes files grouped by bucket; missing files are not an error. */
export async function removePaths(client: SupabaseClient, paths: string[]): Promise<void> {
  const byBucket = new Map<string, string[]>();
  for (const p of paths) {
    if (isProtected(p)) continue;
    const bucket = bucketFor(p);
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), p]);
  }
  for (const [bucket, list] of byBucket) {
    const { error } = await client.storage.from(bucket).remove(list);
    if (error) throw new Error(`storage remove ${bucket}: ${error.message}`);
  }
}
