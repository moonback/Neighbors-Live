import { describe, expect, it } from 'vitest';
import {
  bucketDistance,
  computeExpiresAt,
  createVideoSchema,
  decodeCursor,
  encodeCursor,
  haversineMeters,
  isPlausibleMove,
  isPlausiblePosition,
  moderationDecisionSchema,
  passwordSchema,
  signUpSchema,
  realtimeCell,
  realtimeCells,
  sanitizeText,
  usernameSchema,
  zoneCell,
  zoneCenter,
} from './index.ts';

const paris = { lat: 48.8566, lng: 2.3522 };
const baseVideo = {
  category: 'deal',
  caption: '  Pain au chocolat à 1 €  ',
  ...paris,
  accuracy: 20,
  mimeType: 'video/webm',
  durationMs: 12_000,
  sizeBytes: 2_000_000,
} as const;

describe('geo', () => {
  it('computes haversine distances', () => {
    expect(haversineMeters(paris, { lat: 48.8656, lng: 2.3522 })).toBeCloseTo(1000, -1);
  });

  it('rejects implausible positions', () => {
    expect(isPlausiblePosition(paris)).toBe(true);
    expect(isPlausiblePosition({ lat: 0, lng: 0 })).toBe(false);
    expect(isPlausiblePosition({ lat: 91, lng: 0 })).toBe(false);
    expect(isPlausiblePosition({ lat: Number.NaN, lng: 2 })).toBe(false);
  });

  it('rejects teleportation between publications', () => {
    const t0 = new Date('2026-01-01T10:00:00Z');
    const lyon = { lat: 45.764, lng: 4.8357 };
    const later = (ms: number) => ({ ...lyon, at: new Date(t0.getTime() + ms) });
    expect(isPlausibleMove({ ...paris, at: t0 }, later(60_000))).toBe(false);
    expect(isPlausibleMove({ ...paris, at: t0 }, later(3 * 3_600_000))).toBe(true);
  });

  it('maps to H3 zones and realtime cells covering the radius', () => {
    const zone = zoneCell(paris);
    expect(zone).toMatch(/^88/);
    expect(haversineMeters(zoneCenter(zone), paris)).toBeLessThan(600);
    const cells = realtimeCells(paris, 3000);
    expect(cells).toContain(realtimeCell(paris));
    expect(cells).toContain(realtimeCell({ lat: paris.lat + 0.027, lng: paris.lng }));
  });

  it('buckets public distances to 100 m', () => {
    expect(bucketDistance(12)).toBe(100);
    expect(bucketDistance(249)).toBe(200);
    expect(bucketDistance(1_051)).toBe(1_100);
  });
});

describe('text', () => {
  it('strips control and bidi characters and collapses spaces', () => {
    expect(sanitizeText(' a‮b\u0000   c\n\n\n\nd ')).toBe('ab c\n\nd');
  });
});

describe('lifetime', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const span = (d: Date) => d.getTime() - now.getTime();
  it('applies category lifetimes', () => {
    expect(span(computeExpiresAt('alert', now))).toBe(6 * 3_600_000);
    expect(span(computeExpiresAt('deal', now))).toBe(48 * 3_600_000);
    expect(span(computeExpiresAt('help', now))).toBe(7 * 24 * 3_600_000);
  });
  it('requires a future event end within 7 days', () => {
    const end = new Date('2026-01-02T20:00:00Z');
    expect(computeExpiresAt('event', now, { eventEndsAt: end })).toEqual(end);
    expect(() => computeExpiresAt('event', now)).toThrow('event_end_invalid');
    expect(() => computeExpiresAt('event', now, { eventEndsAt: new Date('2026-02-01') })).toThrow();
  });
  it('requires a merchant duration', () => {
    expect(span(computeExpiresAt('shop', now, { merchantHours: 24 }))).toBe(86_400_000);
    expect(() => computeExpiresAt('shop', now)).toThrow('merchant_duration_invalid');
  });
});

describe('schemas', () => {
  it('accepts a valid video and sanitises the caption', () => {
    expect(createVideoSchema.parse(baseVideo).caption).toBe('Pain au chocolat à 1 €');
  });

  it('rejects poor accuracy, long captions, missing event end, long recordings', () => {
    const bad = (patch: object) => createVideoSchema.safeParse({ ...baseVideo, ...patch }).success;
    expect(bad({ accuracy: 150 })).toBe(false);
    expect(bad({ caption: 'x'.repeat(141) })).toBe(false);
    expect(bad({ category: 'event' })).toBe(false);
    expect(bad({ durationMs: 45_000 })).toBe(false);
    expect(bad({ lat: 0, lng: 0 })).toBe(false);
  });

  it('enforces the password policy', () => {
    expect(passwordSchema.safeParse('voisins2026').success).toBe(true);
    expect(passwordSchema.safeParse('court1').success).toBe(false);
    expect(passwordSchema.safeParse('sanschiffre').success).toBe(false);
    expect(passwordSchema.safeParse('12345678').success).toBe(false);
    expect(passwordSchema.safeParse('a1'.repeat(40)).success).toBe(false);
    expect(
      signUpSchema.parse({ email: ' Lea@Example.ORG ', password: 'voisins2026', username: 'Lea' }),
    ).toEqual({
      email: 'lea@example.org',
      password: 'voisins2026',
      username: 'lea',
    });
  });

  it('validates usernames', () => {
    expect(usernameSchema.parse(' Marie_75 ')).toBe('marie_75');
    expect(usernameSchema.safeParse('a').success).toBe(false);
    expect(usernameSchema.safeParse('drop table;').success).toBe(false);
  });

  it('requires a note to remove a video', () => {
    const ok = (d: object) => moderationDecisionSchema.safeParse(d).success;
    expect(ok({ action: 'remove' })).toBe(false);
    expect(ok({ action: 'remove', note: 'Visage visible' })).toBe(true);
    expect(ok({ action: 'validate' })).toBe(true);
  });

  it('round-trips cursors and rejects garbage', () => {
    const id = '7b0f8f9e-6c2d-4c1a-9a51-3b6c1c3e2f10';
    const cursor = { score: 0.42, id, ref: '2026-10-25T10:00:00.000Z' };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
    expect(decodeCursor('not-a-cursor')).toBeNull();
  });
});
