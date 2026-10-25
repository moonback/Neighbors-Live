import { describe, expect, it, vi } from 'vitest';

vi.mock('idb', () => ({ openDB: vi.fn() }));

const { judge, MAX_AGE_MS } = await import('./offline-queue');
const { containerOf, pickMimeType } = await import('./recorder');

describe('recorder format detection', () => {
  it('prefers MP4 when supported (Safari)', () => {
    const safari = (t: string) => t.startsWith('video/mp4');
    expect(pickMimeType(safari)).toBe('video/mp4;codecs=avc1.42E01E,mp4a.40.2');
  });
  it('falls back to WebM VP9/VP8 (Chrome, Firefox)', () => {
    const chrome = (t: string) => t.startsWith('video/webm');
    expect(pickMimeType(chrome)).toBe('video/webm;codecs=vp9,opus');
    const firefox = (t: string) => t === 'video/webm;codecs=vp8,opus' || t === 'video/webm';
    expect(pickMimeType(firefox)).toBe('video/webm;codecs=vp8,opus');
  });
  it('returns null when recording is impossible', () => {
    expect(pickMimeType(() => false)).toBeNull();
  });
  it('maps to the container type sent to the server', () => {
    expect(containerOf('video/mp4;codecs=avc1')).toBe('video/mp4');
    expect(containerOf('video/webm;codecs=vp9,opus')).toBe('video/webm');
  });
});

describe('offline queue republication rules', () => {
  const filmed = { lat: 48.8722, lng: 2.3767, accuracy: 15 };
  const t0 = 1_000_000;
  const item = { fix: filmed, createdAt: t0 };
  it('republishes when still at the same place with a precise fix', () => {
    expect(judge(item, t0 + 60_000, { lat: 48.8725, lng: 2.3768, accuracy: 20 })).toBe('publish');
  });
  it('drops the recording when the user moved away', () => {
    expect(judge(item, t0 + 60_000, { lat: 48.8822, lng: 2.3767, accuracy: 10 })).toBe(
      'drop-moved',
    );
  });
  it('waits for a precise position instead of deciding on a bad fix', () => {
    expect(judge(item, t0 + 60_000, { ...filmed, accuracy: 250 })).toBe('wait-precision');
  });
  it('drops stale recordings', () => {
    expect(judge(item, t0 + MAX_AGE_MS + 1, filmed)).toBe('drop-stale');
  });
});
