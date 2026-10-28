import { describe, expect, it } from 'vitest';
import { isVideoHidden, readHiddenVideoIds, toggleHiddenVideo } from './hidden-videos';

function makeStorage(initial: string[] = []): Storage {
  const values = new Map<string, string>();
  if (initial.length > 0) {
    values.set('nl-hidden-videos', JSON.stringify(initial));
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

describe('hidden video list', () => {
  it('reads persisted ids from storage', () => {
    const storage = makeStorage(['v1', 'v2']);
    expect(readHiddenVideoIds(storage)).toEqual(['v1', 'v2']);
  });

  it('returns true only for hidden video ids', () => {
    const storage = makeStorage(['v2']);
    expect(isVideoHidden('v1', storage)).toBe(false);
    expect(isVideoHidden('v2', storage)).toBe(true);
  });

  it('adds ids without duplication and removes them on the second toggle', () => {
    const storage = makeStorage();
    const first = toggleHiddenVideo('v42', storage);
    expect(first).toMatchObject({ hidden: true, ids: ['v42'] });
    expect(readHiddenVideoIds(storage)).toEqual(['v42']);

    const second = toggleHiddenVideo('v42', storage);
    expect(second).toMatchObject({ hidden: false, ids: [] });
    expect(readHiddenVideoIds(storage)).toEqual([]);
  });
});
