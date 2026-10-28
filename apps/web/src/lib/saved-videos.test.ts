import { describe, expect, it } from 'vitest';
import { isVideoSaved, readSavedVideoIds, toggleSavedVideo } from './saved-videos';

function makeStorage(initial: string[] = []): Storage {
  const values = new Map<string, string>();
  if (initial.length > 0) {
    values.set('nl-saved-videos', JSON.stringify(initial));
  }

  return {
    getItem(key: string) {
      return values.has(key) ? (values.get(key) ?? null) : null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    get length() {
      return values.size;
    },
  } as Storage;
}

describe('saved video list', () => {
  it('reads persisted ids from storage', () => {
    const storage = makeStorage(['v1', 'v2']);
    expect(readSavedVideoIds(storage)).toEqual(['v1', 'v2']);
  });

  it('returns true only for saved video ids', () => {
    const storage = makeStorage(['v2']);
    expect(isVideoSaved('v1', storage)).toBe(false);
    expect(isVideoSaved('v2', storage)).toBe(true);
  });

  it('adds ids without duplication and removes them on the second toggle', () => {
    const storage = makeStorage();
    const first = toggleSavedVideo('v42', storage);
    expect(first).toMatchObject({ saved: true, ids: ['v42'] });
    expect(readSavedVideoIds(storage)).toEqual(['v42']);

    const second = toggleSavedVideo('v42', storage);
    expect(second).toMatchObject({ saved: false, ids: [] });
    expect(readSavedVideoIds(storage)).toEqual([]);
  });
});
