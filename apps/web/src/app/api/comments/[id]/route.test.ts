import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  deleteComment: vi.fn(),
  commentIdEq: vi.fn(),
  authorIdEq: vi.fn(),
  select: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  getUser: mocks.getUser,
}));

import { DELETE } from './route';

const commentId = 'e0a80123-4567-489a-8bcd-ef0123456789';
const userId = 'd0a80123-4567-489a-8bcd-ef0123456789';

function request(origin = 'http://localhost') {
  return new NextRequest(`http://localhost/api/comments/${commentId}`, {
    method: 'DELETE',
    headers: {
      origin,
      host: 'localhost',
    },
  });
}

describe('comment deletion route', () => {
  beforeEach(() => {
    mocks.getUser.mockResolvedValue({ id: userId });
    mocks.createClient.mockResolvedValue({
      from: () => ({ delete: mocks.deleteComment }),
    });
    mocks.deleteComment.mockReturnValue({ eq: mocks.commentIdEq });
    mocks.commentIdEq.mockReturnValue({ eq: mocks.authorIdEq });
    mocks.authorIdEq.mockReturnValue({ select: mocks.select });
    mocks.select.mockResolvedValue({ data: [{ id: commentId }], error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication before creating a database client', async () => {
    mocks.getUser.mockResolvedValue(null);

    const response = await DELETE(request(), { params: Promise.resolve({ id: commentId }) });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('rejects a cross-origin deletion before authentication or storage', async () => {
    const response = await DELETE(request('https://other.example'), {
      params: Promise.resolve({ id: commentId }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'bad_origin' });
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('deletes only the comment owned by the authenticated user', async () => {
    const response = await DELETE(request(), { params: Promise.resolve({ id: commentId }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.commentIdEq).toHaveBeenCalledWith('id', commentId);
    expect(mocks.authorIdEq).toHaveBeenCalledWith('author_id', userId);
  });

  it('returns not found when no comment belonging to the user was deleted', async () => {
    mocks.select.mockResolvedValue({ data: [], error: null });

    const response = await DELETE(request(), { params: Promise.resolve({ id: commentId }) });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'not_found' });
  });

  it('rejects a malformed comment identifier', async () => {
    const response = await DELETE(request(), { params: Promise.resolve({ id: 'invalid' }) });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid_input' });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
