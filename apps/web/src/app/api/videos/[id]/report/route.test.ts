import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  getUser: mocks.getUser,
}));

import { POST } from './route';

const videoId = 'c0a80123-4567-489a-8bcd-ef0123456789';
const userId = 'd0a80123-4567-489a-8bcd-ef0123456789';

function request(body: unknown, origin = 'http://localhost') {
  return new NextRequest(`http://localhost/api/videos/${videoId}/report`, {
    method: 'POST',
    headers: {
      origin,
      host: 'localhost',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('video report route', () => {
  beforeEach(() => {
    mocks.getUser.mockResolvedValue({ id: userId });
    mocks.createClient.mockResolvedValue({
      from: () => ({ insert: mocks.insert }),
    });
    mocks.insert.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication before parsing or storing a report', async () => {
    mocks.getUser.mockResolvedValue(null);

    const response = await POST(request({ reason: 'spam' }), {
      params: Promise.resolve({ id: videoId }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('rejects a cross-origin mutation before authentication or storage', async () => {
    const response = await POST(request({ reason: 'spam' }, 'https://other.example'), {
      params: Promise.resolve({ id: videoId }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'bad_origin' });
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('rejects an invalid video identifier', async () => {
    const response = await POST(request({ reason: 'spam' }), {
      params: Promise.resolve({ id: 'not-a-uuid' }),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid_input' });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('validates the reason and bounds the optional details', async () => {
    const response = await POST(request({ reason: 'invalid_reason', details: 'x'.repeat(501) }), {
      params: Promise.resolve({ id: videoId }),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid_input' });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('stores the authenticated reporter and returns created', async () => {
    const response = await POST(
      request({ reason: 'spam', details: 'Repeated promotional posts.' }),
      { params: Promise.resolve({ id: videoId }) },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.insert).toHaveBeenCalledWith({
      video_id: videoId,
      reporter_id: userId,
      reason: 'spam',
      details: 'Repeated promotional posts.',
    });
  });

  it('sanitizes optional details before storing them', async () => {
    const response = await POST(request({ reason: 'spam', details: '  Repeated\u202E   spam  ' }), {
      params: Promise.resolve({ id: videoId }),
    });

    expect(response.status).toBe(201);
    expect(mocks.insert).toHaveBeenCalledWith({
      video_id: videoId,
      reporter_id: userId,
      reason: 'spam',
      details: 'Repeated spam',
    });
  });

  it('stores an empty details value when details are omitted', async () => {
    const response = await POST(request({ reason: 'dangerous' }), {
      params: Promise.resolve({ id: videoId }),
    });

    expect(response.status).toBe(201);
    expect(mocks.insert).toHaveBeenCalledWith({
      video_id: videoId,
      reporter_id: userId,
      reason: 'dangerous',
      details: '',
    });
  });

  it('returns a conflict when the user already reported this video', async () => {
    mocks.insert.mockResolvedValue({ error: { code: '23505', message: 'duplicate' } });

    const response = await POST(request({ reason: 'spam' }), {
      params: Promise.resolve({ id: videoId }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'already_reported' });
  });
});
