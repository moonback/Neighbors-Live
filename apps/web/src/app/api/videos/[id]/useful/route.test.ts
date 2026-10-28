import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(),
  deleteReaction: vi.fn(),
  reactionVideoEq: vi.fn(),
  reactionUserEq: vi.fn(),
  select: vi.fn(),
  videoEq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  getUser: mocks.getUser,
}));

import { DELETE, POST } from './route';

const videoId = 'c0a80123-4567-489a-8bcd-ef0123456789';
const userId = 'd0a80123-4567-489a-8bcd-ef0123456789';

function request(method: 'DELETE' | 'POST') {
  return new NextRequest(`http://localhost/api/videos/${videoId}/useful`, {
    method,
    headers: {
      origin: 'http://localhost',
      host: 'localhost',
      'content-type': 'application/json',
    },
    ...(method === 'POST' ? { body: '{}' } : {}),
  });
}

describe('useful reaction route', () => {
  beforeEach(() => {
    mocks.getUser.mockResolvedValue({ id: userId });
    mocks.createClient.mockResolvedValue({
      from: (table: string) => {
        if (table === 'reactions') {
          return {
            insert: mocks.insert,
            delete: mocks.deleteReaction,
          };
        }
        return { select: mocks.select };
      },
    });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.deleteReaction.mockReturnValue({ eq: mocks.reactionVideoEq });
    mocks.reactionVideoEq.mockReturnValue({ eq: mocks.reactionUserEq });
    mocks.reactionUserEq.mockResolvedValue({ data: null, error: null });
    mocks.select.mockReturnValue({ eq: mocks.videoEq });
    mocks.videoEq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.maybeSingle.mockResolvedValue({ data: { useful_count: 1 }, error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication before changing a reaction', async () => {
    mocks.getUser.mockResolvedValue(null);

    const response = await POST(request('POST'), { params: Promise.resolve({ id: videoId }) });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('adds a reaction and returns the current count', async () => {
    const response = await POST(request('POST'), { params: Promise.resolve({ id: videoId }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ reacted: true, usefulCount: 1 });
    expect(mocks.insert).toHaveBeenCalledWith({ video_id: videoId, user_id: userId });
  });

  it('treats a duplicate reaction as an idempotent success', async () => {
    mocks.insert.mockResolvedValue({ error: { code: '23505' } });

    const response = await POST(request('POST'), { params: Promise.resolve({ id: videoId }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ reacted: true, usefulCount: 1 });
  });

  it('removes only the current user reaction and returns the current count', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { useful_count: 0 }, error: null });

    const response = await DELETE(request('DELETE'), {
      params: Promise.resolve({ id: videoId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ reacted: false, usefulCount: 0 });
    expect(mocks.reactionVideoEq).toHaveBeenCalledWith('video_id', videoId);
    expect(mocks.reactionUserEq).toHaveBeenCalledWith('user_id', userId);
  });

  it('surfaces counter read failures instead of returning a false zero', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.maybeSingle.mockResolvedValue({
      data: null,
      error: { code: 'XX000', message: 'database unavailable' },
    });

    const response = await POST(request('POST'), { params: Promise.resolve({ id: videoId }) });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'internal' });
    expect(errorSpy).toHaveBeenCalled();
  });
});
