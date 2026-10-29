import { describe, expect, it } from 'vitest';
import { buildMerchantDashboard, type DashboardRow } from './merchant-dashboard';

const now = new Date('2026-10-29T12:00:00Z');
const quota = { used: 1, quota: 3 };

function row(overrides: Partial<DashboardRow> = {}): DashboardRow {
  return {
    id: 'a0a80123-4567-489a-8bcd-ef0123456789',
    category: 'shop',
    caption: 'Pain du jour',
    offer_terms: '-20 % avant 19 h',
    status: 'active',
    created_at: '2026-10-29T08:00:00Z',
    expires_at: '2026-10-30T08:00:00Z',
    useful_count: 4,
    comment_count: 2,
    ...overrides,
  };
}

describe('buildMerchantDashboard', () => {
  it('counts only active, unexpired videos as active', () => {
    const result = buildMerchantDashboard(
      [
        row({ id: '1' }),
        row({ id: '2', expires_at: '2026-10-29T11:00:00Z' }),
        row({ id: '3', status: 'expired' }),
      ],
      new Map(),
      quota,
      now,
    );
    expect(result.totals.active).toBe(1);
    expect(result.totals.expired).toBe(2);
  });

  it('keeps hidden and expired videos with their historical counters', () => {
    const result = buildMerchantDashboard(
      [row({ id: 'h', status: 'hidden' }), row({ id: 'e', status: 'expired', useful_count: 7 })],
      new Map(),
      quota,
      now,
    );
    expect(result.videos.map((v) => [v.id, v.status, v.useful])).toEqual([
      ['h', 'hidden', 4],
      ['e', 'expired', 7],
    ]);
    expect(result.totals.useful).toBe(11);
  });

  it('reports unmeasured metrics as null, never 0', () => {
    const [video] = buildMerchantDashboard([row()], new Map(), quota, now).videos;
    expect(video?.views).toBeNull();
    expect(video?.offerClicks).toBeNull();
    expect(video?.callClicks).toBeNull();
    expect(video?.directionsClicks).toBeNull();
  });

  it('counts saves from the measured map and defaults to 0', () => {
    const result = buildMerchantDashboard(
      [row({ id: 's' }), row({ id: 'n' })],
      new Map([['s', 5]]),
      quota,
      now,
    );
    expect(result.videos.map((v) => v.saves)).toEqual([5, 0]);
    expect(result.totals.saves).toBe(5);
  });

  it('exposes no derived conversion metric', () => {
    const result = buildMerchantDashboard([row()], new Map(), quota, now);
    expect(Object.keys(result.videos[0] ?? {}).join()).not.toMatch(/conversion|roi|rate/i);
    expect(Object.keys(result.totals).join()).not.toMatch(/conversion|roi|rate/i);
  });
});
