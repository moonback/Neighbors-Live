import { CATEGORIES, type Category } from '@nl/shared';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'nl-feed-reduced-categories';
const CHANGE_EVENT = 'nl-feed-reduced-categories-change';
let memorySnapshot = '';

function resolveStorage(storage?: StorageLike | null): StorageLike | null {
  if (storage !== undefined) return storage;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeCategories(value: unknown): Category[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is Category => CATEGORIES.includes(item)))];
}

export function getReducedCategoriesSnapshot(storage?: StorageLike | null): string {
  const target = resolveStorage(storage);
  if (!target) return memorySnapshot;

  try {
    const saved = target.getItem(STORAGE_KEY);
    if (saved === null) return memorySnapshot;
    memorySnapshot = normalizeCategories(JSON.parse(saved)).join(',');
  } catch {
    return memorySnapshot;
  }
  return memorySnapshot;
}

export function parseReducedCategories(snapshot: string): Category[] {
  return normalizeCategories(snapshot ? snapshot.split(',') : []);
}

export function setReducedCategories(categories: Category[], storage?: StorageLike | null): void {
  memorySnapshot = normalizeCategories(categories).join(',');
  const target = resolveStorage(storage);
  if (!target) return;

  try {
    target.setItem(STORAGE_KEY, JSON.stringify(parseReducedCategories(memorySnapshot)));
  } catch {
    // Keep the preference available for this page session when browser storage is unavailable.
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

export function subscribeToReducedCategories(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener('storage', handleStorage);
  window.addEventListener(CHANGE_EVENT, onChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}
