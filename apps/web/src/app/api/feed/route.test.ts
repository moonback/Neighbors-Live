import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  getUser: mocks.getUser,
}));

vi.mock('@/lib/supabase/admin', () => ({
  adminClient: () => ({ rpc: mocks.rpc }),
}));

vi.mock('@/lib/feed', () => ({
  hydrate: vi.fn(async () => []),
}));

import { GET } from './route';

function request(query: string) {
  return new NextRequest(`http://localhost/api/feed?${query}`);
}

describe('feed route ranking options', () => {
  beforeEach(() => {
    mocks.getUser.mockResolvedValue(null);
    mocks.rpc.mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('passes grouped sections, reduced categories, and sort mode to the database', async () => {
    const response = await GET(
      request(
        'lat=48.87&lng=2.37&radius=1000&section=offers&sort=chronological&reducedCategories=alert,shop',
      ),
      {},
    );

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith(
      'nearby_videos',
      expect.objectContaining({
        p_categories: ['deal', 'shop'],
        p_reduced_categories: ['alert', 'shop'],
        p_sort_mode: 'chronological',
      }),
    );
  });

  it('rejects conflicting category and section filters', async () => {
    const response = await GET(
      request('lat=48.87&lng=2.37&radius=1000&category=alert&section=offers'),
      {},
    );

    expect(response.status).toBe(422);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
