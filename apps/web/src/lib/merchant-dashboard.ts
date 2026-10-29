import type { Database } from '@nl/shared';
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
};

export type MerchantDashboard = {
  quota: MerchantQuota;
  totals: { active: number; expired: number; useful: number; comments: number; saves: number };
  videos: MerchantVideoStats[];
};

export function buildMerchantDashboard(
  rows: DashboardRow[],
  saves: Map<string, number>,
  quota: MerchantQuota,
  now: Date,
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
    views: null,
    offerClicks: null,
    callClicks: null,
    directionsClicks: null,
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
  };
}
