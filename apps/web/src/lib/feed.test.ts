import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  videos: vi.fn(),
  profiles: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  adminClient: () => ({ from: mocks.from }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/media', () => ({
  signMedia: vi.fn(async () => new Map()),
}));

vi.mock('@/lib/profile-image', () => ({
  profileImageUrl: vi.fn(() => null),
}));

import { hydrate } from './feed';

const video = {
  id: 'c0a80123-4567-489a-8bcd-ef0123456789',
  author_id: 'd0a80123-4567-489a-8bcd-ef0123456789',
  author_username: 'voisin',
  author_color: '#123456',
  category: 'alert' as const,
  caption: 'Travaux',
  published_at: null,
  expires_at: '2026-10-30T12:00:00Z',
  useful_count: 0,
  comment_count: 0,
  is_merchant: false,
  public_lat: 48.87,
  public_lng: 2.37,
};

describe('feed hydration', () => {
  beforeEach(() => {
    mocks.from.mockImplementation((table: string) => ({
      select: () => ({
        in: () => (table === 'videos' ? mocks.videos() : mocks.profiles()),
      }),
    }));
    mocks.videos.mockResolvedValue({
      data: [
        {
          id: video.id,
          video_path: null,
          poster_path: null,
          offer_terms: '',
          orientation: 'landscape',
        },
      ],
    });
    mocks.profiles.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('passes the stored orientation through to the feed item', async () => {
    await expect(hydrate([video], null)).resolves.toMatchObject([
      { id: video.id, orientation: 'landscape' },
    ]);
  });

  it('defaults legacy feed data to portrait', async () => {
    mocks.videos.mockResolvedValue({
      data: [{ id: video.id, video_path: null, poster_path: null, offer_terms: '' }],
    });

    await expect(hydrate([video], null)).resolves.toMatchObject([
      { id: video.id, orientation: 'portrait' },
    ]);
  });
});
