import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  loadMerchantDashboard: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  getUser: mocks.getUser,
}));
vi.mock('@/lib/merchant-dashboard.server', () => ({
  loadMerchantDashboard: mocks.loadMerchantDashboard,
}));

import { GET } from './route';

const userId = 'd0a80123-4567-489a-8bcd-ef0123456789';
const dashboard = {
  quota: { used: 0, quota: 3 },
  totals: { active: 0, expired: 0, useful: 0, comments: 0, saves: 0 },
  videos: [],
};

const request = () => new NextRequest('http://localhost/api/merchant/dashboard');

describe('merchant dashboard route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ id: userId });
    const eq = vi.fn().mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.createClient.mockResolvedValue({
      from: () => ({ select: () => ({ eq }) }),
    });
    mocks.loadMerchantDashboard.mockResolvedValue(dashboard);
  });

  it('rejects anonymous visitors', async () => {
    mocks.getUser.mockResolvedValue(null);
    expect((await GET(request(), undefined)).status).toBe(401);
  });

  it.each([['pending'], ['rejected']])('rejects %s merchants without data', async (status) => {
    mocks.maybeSingle.mockResolvedValue({ data: { status }, error: null });
    const res = await GET(request(), undefined);
    expect(res.status).toBe(403);
    expect(mocks.loadMerchantDashboard).not.toHaveBeenCalled();
  });

  it('rejects users without merchant profile', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await GET(request(), undefined)).status).toBe(403);
  });

  it('returns the dashboard of an approved merchant', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { status: 'approved' }, error: null });
    const res = await GET(request(), undefined);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(dashboard);
    expect(mocks.loadMerchantDashboard).toHaveBeenCalledWith(userId);
  });
});
