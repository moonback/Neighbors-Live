import type { Database, VideoEventKind } from '@nl/shared';
import { getOfferStatus, type OfferStatus } from './offer-status';

type VideoStatus = Database['public']['Enums']['video_status'];

export type DashboardRow = {
  id: string;
  category: string;
  caption: string;
  offer_terms: string;
  status: VideoStatus;
  created_at: string;
  expires_at: string;
  useful_count: number;
  comment_count: number;
};

export type MerchantQuota = { used: number; quota: number };

export type MerchantVideoStats = {
  id: string;
  caption: string;
  offerTerms: string;
  status: VideoStatus;
  offerStatus: OfferStatus;
  createdAt: string;
  expiresAt: string;
  useful: number;
  comments: number;
  saves: number;
  // null = not measured: the UI must say so instead of showing 0.
  views: number | null;
  offerClicks: number | null;
  callClicks: number | null;
  directionsClicks: number | null;
  dailyViews: { day: string; views: number }[] | null; // last 7 days, oldest first
};

export type MerchantDashboard = {
  quota: MerchantQuota;
  totals: { active: number; expired: number; useful: number; comments: number; saves: number };
  videos: MerchantVideoStats[];
  measuredSince: string | null;
};

export type StatRow = { video_id: string; day: string; kind: VideoEventKind; count: number };
export type MeasuredStats = { since: Date; rows: StatRow[] };

const DAY_MS = 86_400_000;

function measured(r: DashboardRow, stats: MeasuredStats | null, now: Date) {
  // A video published before measurement started has partial data: report it as unavailable.
  if (!stats || Date.parse(r.created_at) < stats.since.getTime()) {
    return {
      views: null,
      offerClicks: null,
      callClicks: null,
      directionsClicks: null,
      dailyViews: null,
    };
  }
  const own = stats.rows.filter((s) => s.video_id === r.id);
  const total = (kind: VideoEventKind) =>
    own.filter((s) => s.kind === kind).reduce((n, s) => n + s.count, 0);
  const dailyViews = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now.getTime() - (6 - i) * DAY_MS).toISOString().slice(0, 10);
    const views = own.find((s) => s.kind === 'view' && s.day === day)?.count ?? 0;
    return { day, views };
  });
  return {
    views: total('view'),
    offerClicks: total('offer_click'),
    callClicks: total('call_click'),
    directionsClicks: total('directions_click'),
    dailyViews,
  };
}

export function buildMerchantDashboard(
  rows: DashboardRow[],
  saves: Map<string, number>,
  quota: MerchantQuota,
  now: Date,
  stats: MeasuredStats | null = null,
): MerchantDashboard {
  const videos = rows.map((r): MerchantVideoStats => ({
    id: r.id,
    caption: r.caption,
    offerTerms: r.offer_terms,
    status: r.status,
    offerStatus: getOfferStatus(r.category, true, r.expires_at, r.status, now),
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    useful: r.useful_count,
    comments: r.comment_count,
    saves: saves.get(r.id) ?? 0,
    ...measured(r, stats, now),
  }));
  const live = (v: MerchantVideoStats) =>
    v.status === 'active' && Date.parse(v.expiresAt) > now.getTime();
  const sum = (key: 'useful' | 'comments' | 'saves') => videos.reduce((n, v) => n + v[key], 0);
  return {
    quota,
    totals: {
      active: videos.filter(live).length,
      expired: videos.filter((v) => v.status === 'expired' || (v.status === 'active' && !live(v)))
        .length,
      useful: sum('useful'),
      comments: sum('comments'),
      saves: sum('saves'),
    },
    videos,
    measuredSince: stats?.since.toISOString() ?? null,
  };
}
