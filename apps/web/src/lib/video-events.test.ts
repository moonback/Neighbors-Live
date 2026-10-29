import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trackVideoEvent } from './video-events';

const fetchMock = vi.fn();

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
  });
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe('trackVideoEvent', () => {
  it('sends one view per video and tab', () => {
    trackVideoEvent('v1', 'view');
    trackVideoEvent('v1', 'view');
    trackVideoEvent('v2', 'view');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/videos/v1/events');
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body)).toEqual({ kind: 'view' });
    expect(fetchMock.mock.calls[0]?.[1].keepalive).toBe(true);
  });

  it('sends every click', () => {
    trackVideoEvent('v1', 'offer_click');
    trackVideoEvent('v1', 'offer_click');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never throws on network or storage failure', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => trackVideoEvent('v1', 'view')).not.toThrow();
    await Promise.resolve();
  });
});
