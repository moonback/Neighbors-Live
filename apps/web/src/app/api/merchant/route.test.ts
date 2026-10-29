import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  update: vi.fn(),
  updateEq: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  getUser: mocks.getUser,
}));

import { PATCH } from './route';

const userId = 'd0a80123-4567-489a-8bcd-ef0123456789';
const contact = {
  description: 'Fruits et légumes',
  website: 'lune.example',
  phone: '01 23 45 67 89',
  address: '1 rue de la Lune',
  openingHours: '8 h – 20 h',
};

function request(body: unknown) {
  return new NextRequest('http://localhost/api/merchant', {
    method: 'PATCH',
    headers: { origin: 'http://localhost', host: 'localhost', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('merchant profile update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ id: userId });
    mocks.maybeSingle.mockResolvedValue({ data: { status: 'approved' }, error: null });
    mocks.update.mockReturnValue({ eq: mocks.updateEq });
    mocks.updateEq.mockResolvedValue({ data: null, error: null });
    mocks.createClient.mockResolvedValue({
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
        update: mocks.update,
      }),
    });
  });

  it('updates contact details of an approved merchant, never the name', async () => {
    const res = await PATCH(request({ ...contact, businessName: 'Autre nom' }), undefined);
    expect(res.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      description: 'Fruits et légumes',
      website: 'https://lune.example',
      phone: '01 23 45 67 89',
      address: '1 rue de la Lune',
      opening_hours: '8 h – 20 h',
    });
    expect(mocks.updateEq).toHaveBeenCalledWith('user_id', userId);
  });

  it('rejects pending merchants', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { status: 'pending' }, error: null });
    expect((await PATCH(request(contact), undefined)).status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('rejects invalid websites', async () => {
    const res = await PATCH(request({ ...contact, website: 'https://exa mple' }), undefined);
    expect(res.status).toBe(422);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('rejects anonymous visitors', async () => {
    mocks.getUser.mockResolvedValue(null);
    expect((await PATCH(request(contact), undefined)).status).toBe(401);
  });
});
