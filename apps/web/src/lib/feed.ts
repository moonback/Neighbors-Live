import type { Category } from '@nl/shared';
import { signMedia } from '@/lib/media';
import { adminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/** Public shape of a video in the feed. Never contains the exact position. */
export interface FeedItem {
  id: string;
  category: Category;
  caption: string;
  author: { id: string; username: string | null; color: string; isMerchant: boolean };
  publishedAt: string | null;
  expiresAt: string;
  usefulCount: number;
  commentCount: number;
  isMerchant: boolean;
  /** Fuzzed (~50 m) public position. */
  lat: number;
  lng: number;
  /** Bucketed to 100 m; null when the viewer position is unknown (deep link). */
  distanceM: number | null;
  videoUrl: string | null;
  posterUrl: string | null;
  reacted: boolean;
}

export interface PublicVideoRow {
  id: string;
  author_id: string;
  author_username: string | null;
  author_color: string;
  author_is_merchant?: boolean;
  category: Category;
  caption: string;
  published_at: string | null;
  expires_at: string;
  useful_count: number;
  comment_count: number;
  is_merchant: boolean;
  public_lat: number;
  public_lng: number;
  distance_m?: number;
}

/** Adds short-lived media URLs and the viewer's "useful" state to public rows. */
export async function hydrate(
  rows: PublicVideoRow[],
  viewerId: string | null,
): Promise<FeedItem[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const { data: paths } = await adminClient()
    .from('videos')
    .select('id, video_path, poster_path')
    .in('id', ids);
  const byId = new Map((paths ?? []).map((p) => [p.id, p]));
  const urls = await signMedia((paths ?? []).flatMap((p) => [p.video_path, p.poster_path]));
  let reacted = new Set<string>();
  if (viewerId) {
    const supabase = await createClient();
    const { data } = await supabase.from('reactions').select('video_id').in('video_id', ids);
    reacted = new Set((data ?? []).map((r) => r.video_id));
  }
  return rows.map((r) => {
    const p = byId.get(r.id);
    return {
      id: r.id,
      category: r.category,
      caption: r.caption,
      author: {
        id: r.author_id,
        username: r.author_username,
        color: r.author_color,
        isMerchant: Boolean(r.author_is_merchant ?? r.is_merchant),
      },
      publishedAt: r.published_at,
      expiresAt: r.expires_at,
      usefulCount: r.useful_count,
      commentCount: r.comment_count,
      isMerchant: r.is_merchant,
      lat: r.public_lat,
      lng: r.public_lng,
      distanceM: r.distance_m ?? null,
      videoUrl: p?.video_path ? (urls.get(p.video_path) ?? null) : null,
      posterUrl: p?.poster_path ? (urls.get(p.poster_path) ?? null) : null,
      reacted: reacted.has(r.id),
    };
  });
}
