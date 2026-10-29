import { describe, expect, it } from 'vitest';
import { buildMerchantDashboard, type DashboardRow, type StatRow } from './merchant-dashboard';

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

describe('buildMerchantDashboard with measured statistics', () => {
  const since = new Date('2026-10-28T00:00:00Z');
  const stats = (rows: StatRow[]) => ({ since, rows });

  it('video_stats_null_before_tracking: older videos stay "not available"', () => {
    const [video] = buildMerchantDashboard(
      [row({ created_at: '2026-10-27T08:00:00Z' })],
      new Map(),
      quota,
      now,
      stats([{ video_id: row().id, day: '2026-10-29', kind: 'view', count: 3 }]),
    ).videos;
    expect(video?.views).toBeNull();
    expect(video?.offerClicks).toBeNull();
    expect(video?.dailyViews).toBeNull();
  });

  it('video_stats_zero_when_measured: measured but unseen means 0', () => {
    const [video] = buildMerchantDashboard([row()], new Map(), quota, now, stats([])).videos;
    expect(video?.views).toBe(0);
    expect(video?.directionsClicks).toBe(0);
    expect(video?.dailyViews?.map((d) => d.views)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('sums counters across days and kinds', () => {
    const id = row().id;
    const [video] = buildMerchantDashboard(
      [row()],
      new Map(),
      quota,
      now,
      stats([
        { video_id: id, day: '2026-10-28', kind: 'view', count: 4 },
        { video_id: id, day: '2026-10-29', kind: 'view', count: 6 },
        { video_id: id, day: '2026-10-29', kind: 'offer_click', count: 2 },
        { video_id: id, day: '2026-10-29', kind: 'call_click', count: 1 },
        { video_id: 'other', day: '2026-10-29', kind: 'view', count: 99 },
      ]),
    ).videos;
    expect(video).toMatchObject({ views: 10, offerClicks: 2, callClicks: 1, directionsClicks: 0 });
    expect(video?.dailyViews?.at(-1)).toEqual({ day: '2026-10-29', views: 6 });
    expect(video?.dailyViews?.at(-2)).toEqual({ day: '2026-10-28', views: 4 });
    expect(Object.keys(video ?? {}).join()).not.toMatch(/conversion|roi|rate/i);
  });
});
