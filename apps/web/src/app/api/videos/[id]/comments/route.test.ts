import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
  getAuthenticatedUser: vi.fn(),
  queryEq: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  before: vi.fn(),
  rows: [] as Array<Record<string, unknown>>,
  queryError: null as { code?: string; message: string } | null,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  getUser: mocks.getUser,
}));

vi.mock('@/lib/profile-image', () => ({
  profileImageUrl: (path: string | null) => (path ? `https://images.example/${path}` : null),
}));

import { GET, POST } from './route';

const videoId = 'c0a80123-4567-489a-8bcd-ef0123456789';
const userId = 'd0a80123-4567-489a-8bcd-ef0123456789';

function request(body: unknown, origin = 'http://localhost') {
  return new NextRequest(`http://localhost/api/videos/${videoId}/comments`, {
    method: 'POST',
    headers: {
      origin,
      host: 'localhost',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('video comments route', () => {
  beforeEach(() => {
    mocks.getUser.mockResolvedValue({ id: userId });
    mocks.getAuthenticatedUser.mockResolvedValue({ data: { user: null }, error: null });
    mocks.rows = [];
    mocks.queryError = null;
    const queryBuilder = {
      eq: mocks.queryEq,
      order: mocks.order,
      limit: mocks.limit,
      lt: mocks.before,
      single: mocks.single,
      get data() {
        return mocks.rows;
      },
      get error() {
        return mocks.queryError;
      },
    };
    mocks.queryEq.mockReturnValue(queryBuilder);
    mocks.order.mockReturnValue(queryBuilder);
    mocks.limit.mockReturnValue(queryBuilder);
    mocks.before.mockReturnValue(queryBuilder);
    mocks.createClient.mockResolvedValue({
      from: () => ({
        insert: mocks.insert,
        select: mocks.select,
      }),
      auth: { getUser: mocks.getAuthenticatedUser },
    });
    mocks.insert.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue(queryBuilder);
    mocks.single.mockResolvedValue({
      data: {
        id: 'e0a80123-4567-489a-8bcd-ef0123456789',
        body: 'A neighbour shared an update.',
        created_at: '2026-10-28T18:00:00.000Z',
        author_id: userId,
        author: {
          username: 'voisin',
          avatar_color: '#123456',
          avatar_path: 'users/user/avatar.png',
        },
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('lists public comments for an anonymous viewer without marking them as mine', async () => {
    mocks.rows = [
      {
        id: 'e0a80123-4567-489a-8bcd-ef0123456789',
        body: 'A neighbour shared an update.',
        created_at: '2026-10-28T18:00:00.000Z',
        author_id: userId,
        author: {
          username: 'voisin',
          avatar_color: '#123456',
          avatar_path: 'users/user/avatar.png',
        },
      },
    ];

    const response = await GET(new NextRequest(`http://localhost/api/videos/${videoId}/comments`), {
      params: Promise.resolve({ id: videoId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      comments: [
        {
          ...mocks.rows[0],
          author: {
            username: 'voisin',
            avatar_color: '#123456',
            avatar_path: 'users/user/avatar.png',
            avatar_url: 'https://images.example/users/user/avatar.png',
          },
          mine: false,
        },
      ],
      nextBefore: null,
    });
    expect(mocks.getAuthenticatedUser).toHaveBeenCalledOnce();
  });

  it('marks comments by the signed-in viewer as their own', async () => {
    mocks.getAuthenticatedUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    mocks.rows = [
      {
        id: 'e0a80123-4567-489a-8bcd-ef0123456789',
        body: 'My comment.',
        created_at: '2026-10-28T18:00:00.000Z',
        author_id: userId,
        author: null,
      },
    ];

    const response = await GET(new NextRequest(`http://localhost/api/videos/${videoId}/comments`), {
      params: Promise.resolve({ id: videoId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      comments: [{ id: 'e0a80123-4567-489a-8bcd-ef0123456789', mine: true, author: null }],
    });
  });

  it('rejects invalid pagination cursors before querying comments', async () => {
    const response = await GET(
      new NextRequest(`http://localhost/api/videos/${videoId}/comments?before=not-a-timestamp`),
      { params: Promise.resolve({ id: videoId }) },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid_input' });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('applies a valid cursor and returns the next page cursor', async () => {
    const cursor = '2026-10-28T18:00:00.000Z';
    mocks.rows = Array.from({ length: 20 }, (_, index) => ({
      id: `e0a80123-4567-489a-8bcd-ef012345${String(index).padStart(4, '0')}`,
      body: `Comment ${index}`,
      created_at: `2026-10-28T18:${String(index).padStart(2, '0')}:00.000Z`,
      author_id: userId,
      author: null,
    }));

    const response = await GET(
      new NextRequest(
        `http://localhost/api/videos/${videoId}/comments?before=${encodeURIComponent(cursor)}`,
      ),
      { params: Promise.resolve({ id: videoId }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.comments).toHaveLength(20);
    expect(body.nextBefore).toBe(mocks.rows[19]?.created_at);
    expect(mocks.before).toHaveBeenCalledWith('created_at', cursor);
  });

  it('returns a server error when the comments query fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.queryError = { code: 'XX000', message: 'database unavailable' };

    const response = await GET(new NextRequest(`http://localhost/api/videos/${videoId}/comments`), {
      params: Promise.resolve({ id: videoId }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'internal' });
    expect(errorSpy).toHaveBeenCalled();
  });

  it('requires authentication before parsing or storing a comment', async () => {
    mocks.getUser.mockResolvedValue(null);

    const response = await POST(request({ body: 'Hello' }), {
      params: Promise.resolve({ id: videoId }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('rejects a cross-origin mutation before authentication or storage', async () => {
    const response = await POST(request({ body: 'Hello' }, 'https://other.example'), {
      params: Promise.resolve({ id: videoId }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'bad_origin' });
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('rejects empty or whitespace-only sanitized comment text', async () => {
    const response = await POST(request({ body: ' \u202E  ' }), {
      params: Promise.resolve({ id: videoId }),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid_input' });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('sanitizes comment text and returns the created public author details', async () => {
    mocks.single.mockResolvedValue({
      data: {
        id: 'e0a80123-4567-489a-8bcd-ef0123456789',
        body: 'A neighbour shared an update.',
        created_at: '2026-10-28T18:00:00.000Z',
        author_id: userId,
        author: {
          username: 'voisin',
          avatar_color: '#123456',
          avatar_path: 'users/user/avatar.png',
        },
      },
      error: null,
    });

    const response = await POST(request({ body: '  Hello\u202E   neighbours  ' }), {
      params: Promise.resolve({ id: videoId }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: 'e0a80123-4567-489a-8bcd-ef0123456789',
      body: 'A neighbour shared an update.',
      created_at: '2026-10-28T18:00:00.000Z',
      author_id: userId,
      author: {
        username: 'voisin',
        avatar_color: '#123456',
        avatar_path: 'users/user/avatar.png',
        avatar_url: 'https://images.example/users/user/avatar.png',
      },
      mine: true,
    });
    expect(mocks.insert).toHaveBeenCalledWith({
      video_id: videoId,
      author_id: userId,
      body: 'Hello neighbours',
    });
  });

  it('returns too many requests when the database rate limit is reached', async () => {
    mocks.single.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'rate_limited' },
    });

    const response = await POST(request({ body: 'A useful update' }), {
      params: Promise.resolve({ id: videoId }),
    });

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: 'rate_limited' });
  });
});
