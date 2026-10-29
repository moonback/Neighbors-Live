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

import { POST } from './route';

const userId = 'd0a80123-4567-489a-8bcd-ef0123456789';
const videoId = 'c0a80123-4567-489a-8bcd-ef0123456789';
const requestId = 'e0a80123-4567-489a-8bcd-ef0123456789';

function request(body: unknown) {
  return new NextRequest('http://localhost/api/videos', {
    method: 'POST',
    headers: {
      origin: 'http://localhost',
      host: 'localhost',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('video reservation route', () => {
  beforeEach(() => {
    mocks.getUser.mockResolvedValue({ id: userId });
    mocks.rpc.mockResolvedValue({ data: videoId, error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('passes structured offer terms and the client request id to create_video', async () => {
    const response = await POST(
      request({
        category: 'shop',
        caption: 'Offre du jour',
        lat: 48.8722,
        lng: 2.3767,
        accuracy: 12,
        mimeType: 'video/webm',
        durationMs: 9000,
        sizeBytes: 9000,
        requestId,
        merchantHours: 24,
        offerTerms: 'Hors boissons',
      }),
      {},
    );

    expect(response.status).toBe(201);
    expect(mocks.rpc).toHaveBeenCalledWith(
      'create_video',
      expect.objectContaining({
        p_author: userId,
        p_request_id: requestId,
        p_offer_terms: 'Hors boissons',
      }),
    );
    await expect(response.json()).resolves.toMatchObject({ videoId });
  });

  it('reuses the same client request id when a reservation request is retried', async () => {
    const payload = {
      category: 'alert',
      caption: 'Test de reprise',
      lat: 48.8722,
      lng: 2.3767,
      accuracy: 12,
      mimeType: 'video/webm',
      durationMs: 9000,
      sizeBytes: 9000,
      requestId,
    };

    const first = await POST(request(payload), {});
    const retry = await POST(request(payload), {});

    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    await expect(first.json()).resolves.toMatchObject({ videoId });
    await expect(retry.json()).resolves.toMatchObject({ videoId });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc).toHaveBeenNthCalledWith(
      1,
      'create_video',
      expect.objectContaining({ p_request_id: requestId }),
    );
    expect(mocks.rpc).toHaveBeenNthCalledWith(
      2,
      'create_video',
      expect.objectContaining({ p_request_id: requestId }),
    );
  });
});
