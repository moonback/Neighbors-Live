export const CATEGORIES = ['alert', 'deal', 'event', 'help', 'shop', 'lost'] as const;
export type Category = (typeof CATEGORIES)[number];

export const FEED_SECTIONS = ['alerts', 'events', 'help', 'offers'] as const;
export type FeedSection = (typeof FEED_SECTIONS)[number];
export const FEED_SECTION_CATEGORIES: Record<FeedSection, Category[]> = {
  alerts: ['alert'],
  events: ['event'],
  help: ['help'],
  offers: ['deal', 'shop'],
};

export const FEED_SORTS = ['relevance', 'chronological'] as const;
export type FeedSort = (typeof FEED_SORTS)[number];

export const RADII_M = [300, 1000, 3000, 5000, 10000] as const;
export type Radius = (typeof RADII_M)[number];

export const MAX_RECORDING_MS = 30_000;
export const MAX_ACCURACY_M = 500;
export const CAPTION_MAX = 140;
export const COMMENT_MAX = 280;
export const BIO_MAX = 160;
export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

/** H3 resolution of moderation zones ("quartiers"), ~0.74 km² per cell. */
export const H3_ZONE_RES = 8;
/** Coarser H3 resolution used for realtime alert topics, ~5 km² per cell. */
export const H3_REALTIME_RES = 7;

const HOUR = 3_600_000;
export const LIFETIME_MS: Record<Exclude<Category, 'event' | 'shop'>, number> = {
  alert: 6 * HOUR,
  deal: 48 * HOUR,
  help: 7 * 24 * HOUR,
  lost: 7 * 24 * HOUR,
};
export const MAX_LIFETIME_MS = 7 * 24 * HOUR;
export const MERCHANT_DURATIONS_H = [6, 24, 48, 72, 168] as const;

export const REPORT_REASONS = [
  'recognizable_person',
  'address_or_plate',
  'dangerous',
  'harassment',
  'spam',
  'false_info',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const MODERATION_ACTIONS = ['validate', 'hide', 'remove', 'warn'] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export const VIDEO_STATUSES = [
  'processing',
  'active',
  'hidden',
  'removed',
  'expired',
  'rejected',
] as const;
export type VideoStatus = (typeof VIDEO_STATUSES)[number];

export const VIDEO_ORIENTATIONS = ['portrait', 'landscape'] as const;
export type VideoOrientation = (typeof VIDEO_ORIENTATIONS)[number];

export const CATEGORY_COLORS: Record<Category, string> = {
  alert: '#1d4ed8',
  deal: '#0369a1',
  event: '#1e40af',
  help: '#075985',
  shop: '#1e3a8a',
  lost: '#0e7490',
};
