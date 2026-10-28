import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  getUser: mocks.getUser,
}));

vi.mock('@/lib/supabase/admin', () => ({ adminClient: vi.fn() }));
vi.mock('@/lib/media', () => ({ signMedia: vi.fn() }));

import { GET as getHiddenVideos } from './hidden-videos/route';
import { GET as getSavedVideos } from './saved-videos/route';

afterEach(() => {
  vi.clearAllMocks();
});

describe('private video collection routes', () => {
  it.each([
    ['saved videos', getSavedVideos, '/api/me/saved-videos'],
    ['hidden videos', getHiddenVideos, '/api/me/hidden-videos'],
  ])('requires authentication to read %s', async (_name, handler, path) => {
    mocks.getUser.mockResolvedValue(null);

    const response = await handler(new NextRequest(`http://localhost${path}`), {});

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
  });
});
