import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ getUser: mocks.getUser }));
vi.mock('@/lib/supabase/admin', () => ({ adminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock('@/lib/env.server', () => ({ serverEnv: () => ({ IP_HASH_SALT: 'test-salt' }) }));

import { POST } from './route';

const videoId = 'c0a80123-4567-489a-8bcd-ef0123456789';
const userId = 'd0a80123-4567-489a-8bcd-ef0123456789';

function request(body: unknown, id = videoId) {
  return [
    new NextRequest(`http://localhost/api/videos/${id}/events`, {
      method: 'POST',
      headers: {
        origin: 'http://localhost',
        host: 'localhost',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  ] as const;
}

describe('video events route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ id: userId });
    mocks.rpc.mockResolvedValue({ data: null, error: null });
  });

  it('records an event for the signed-in actor', async () => {
    const res = await POST(...request({ kind: 'offer_click' }));
    expect(res.status).toBe(204);
    expect(mocks.rpc).toHaveBeenCalledWith('record_video_event', {
      p_video: videoId,
      p_kind: 'offer_click',
      p_rate_key: userId,
      p_actor: userId,
    });
  });

  it('records anonymous views with a hashed key, never the raw IP', async () => {
    mocks.getUser.mockResolvedValue(null);
    const [req, ctx] = request({ kind: 'view' });
    req.headers.set('x-forwarded-for', '203.0.113.7');
    expect((await POST(req, ctx)).status).toBe(204);
    const args = mocks.rpc.mock.calls[0]?.[1];
    expect(args.p_actor).toBeUndefined();
    expect(args.p_rate_key).not.toContain('203.0.113.7');
  });

  it('rejects unknown kinds', async () => {
    expect((await POST(...request({ kind: 'purchase' }))).status).toBe(422);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('rejects invalid video ids', async () => {
    expect((await POST(...request({ kind: 'view' }, 'nope'))).status).toBe(422);
  });

  it('maps the database rate limit to 429', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'rate_limited', code: 'P0001' } });
    expect((await POST(...request({ kind: 'view' }))).status).toBe(429);
  });
});
