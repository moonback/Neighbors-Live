import { VIDEO_BUCKET } from '@nl/shared';
import { adminClient, SIGNED_URL_TTL_S } from '@/lib/supabase/admin';

/** Short-lived signed URLs for private processed media (videos bucket only). */
export async function signMedia(
  paths: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  const out = new Map<string, string>();
  if (unique.length === 0) return out;
  const { data, error } = await adminClient()
    .storage.from(VIDEO_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL_S);
  if (error) throw error;
  for (const row of data) if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  return out;
}
