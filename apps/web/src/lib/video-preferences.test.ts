import { beforeEach, describe, expect, it } from 'vitest';
import { getVideoMuted, setVideoMuted } from './video-preferences';

function makeStorage(initial?: string): Storage {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set('nl-video-muted', initial);

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size;
    },
  } as Storage;
}

describe('video sound preference', () => {
  beforeEach(() => setVideoMuted(true, null));

  it('defaults to muted when no preference has been saved', () => {
    expect(getVideoMuted(null)).toBe(true);
    expect(getVideoMuted(makeStorage())).toBe(true);
  });

  it('reads and persists the preference in browser storage', () => {
    const storage = makeStorage();

    setVideoMuted(false, storage);

    expect(storage.getItem('nl-video-muted')).toBe('false');
    expect(getVideoMuted(storage)).toBe(false);
  });

  it('uses the safe muted default for unrecognized stored values', () => {
    expect(getVideoMuted(makeStorage('invalid'))).toBe(true);
  });
});
