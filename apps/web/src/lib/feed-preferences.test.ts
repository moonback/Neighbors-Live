import { beforeEach, describe, expect, it } from 'vitest';
import {
  getReducedCategoriesSnapshot,
  parseReducedCategories,
  setReducedCategories,
} from './feed-preferences';

function makeStorage(initial?: string, failWrites = false): Storage {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set('nl-feed-reduced-categories', initial);

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (failWrites) throw new Error('Storage unavailable');
      values.set(key, value);
    },
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size;
    },
  } as Storage;
}

describe('feed category preferences', () => {
  beforeEach(() => setReducedCategories([], null));

  it('stores reduced categories and ignores invalid or duplicate values', () => {
    const storage = makeStorage('["help","unknown","help","shop"]');

    expect(getReducedCategoriesSnapshot(storage)).toBe('help,shop');
    expect(parseReducedCategories(getReducedCategoriesSnapshot(storage))).toEqual(['help', 'shop']);
  });

  it('keeps the in-memory preference when storage writes fail', () => {
    setReducedCategories(['event'], makeStorage(undefined, true));

    expect(getReducedCategoriesSnapshot(null)).toBe('event');
  });
});
