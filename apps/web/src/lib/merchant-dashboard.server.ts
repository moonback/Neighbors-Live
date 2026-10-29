import { unwrap } from '@/lib/api';
import {
  buildMerchantDashboard,
  type MerchantDashboard,
  type MerchantQuota,
} from './merchant-dashboard';
import { adminClient } from './supabase/admin';
import { createClient } from './supabase/server';

export async function merchantQuota(userId: string): Promise<MerchantQuota> {
  const admin = adminClient();
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const [{ count }, own, config] = await Promise.all([
    admin
      .from('videos')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', userId)
      .eq('is_merchant', true)
      .gt('created_at', since),
    admin.from('merchant_profiles').select('daily_quota').eq('user_id', userId).single(),
    admin.from('app_config').select('value').eq('key', 'merchant_daily_quota').single(),
  ]);
  return { used: count ?? 0, quota: own.data?.daily_quota ?? Number(config.data?.value ?? 3) };
}

/** Caller must have checked that `userId` is an approved merchant. */
export async function loadMerchantDashboard(userId: string): Promise<MerchantDashboard> {
  const supabase = await createClient();
  const [rows, quota, since] = await Promise.all([
    // offer_terms has no column grant for clients: read the author's own rows with the service role.
    adminClient()
      .from('videos')
      .select(
        'id, category, caption, offer_terms, status, created_at, expires_at, useful_count, comment_count',
      )
      .eq('author_id', userId)
      .eq('is_merchant', true)
      .order('created_at', { ascending: false })
      .limit(100),
    merchantQuota(userId),
    adminClient()
      .from('app_config')
      .select('value')
      .eq('key', 'merchant_stats_since')
      .maybeSingle(),
  ]);
  const videos = unwrap(rows) ?? [];
  const ids = videos.map((v) => v.id);
  // saved_videos RLS only shows a user their own rows: count with the service role, ids only.
  // shortcut: counts in JS from one row per save, move to a SQL aggregate if saves grow large.
  const [saved, statRows] = ids.length
    ? await Promise.all([
        adminClient().from('saved_videos').select('video_id').in('video_id', ids).then(unwrap),
        // RLS: the author reads the counters of their own videos only.
        supabase
          .from('video_daily_stats')
          .select('video_id, day, kind, count')
          .in('video_id', ids)
          .then(unwrap),
      ])
    : [[], []];
  const saves = new Map<string, number>();
  for (const { video_id } of saved ?? []) saves.set(video_id, (saves.get(video_id) ?? 0) + 1);
  const sinceValue = since.data?.value;
  const stats =
    typeof sinceValue === 'string' ? { since: new Date(sinceValue), rows: statRows ?? [] } : null;
  return buildMerchantDashboard(videos, saves, quota, new Date(), stats);
}
