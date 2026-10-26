import { clientEnv } from '@/lib/env';

/** Public URL for an object stored in the dedicated profile image bucket. */
export function profileImageUrl(path: string | null): string | null {
  if (!path) return null;
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `${clientEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profile-images/${encodedPath}`;
}
