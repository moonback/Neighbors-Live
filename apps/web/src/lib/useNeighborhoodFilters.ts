'use client';

import { CATEGORIES, RADII_M, type Category } from '@nl/shared';
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'nl-neighborhood-filters';
const CHANGE_EVENT = 'nl-neighborhood-filters-change';
let memorySnapshot = '{}';

interface Filters {
  radius: number;
  category: Category | null;
}

function parseFilters(snapshot: string): Partial<Filters> {
  try {
    const saved = JSON.parse(snapshot) as { radius?: unknown; category?: unknown } | null;
    return {
      radius:
        typeof saved?.radius === 'number' &&
        RADII_M.includes(saved.radius as (typeof RADII_M)[number])
          ? saved.radius
          : undefined,
      category:
        saved?.category === null ||
        (typeof saved?.category === 'string' && CATEGORIES.includes(saved.category as Category))
          ? (saved.category as Category | null)
          : undefined,
    };
  } catch {
    return {};
  }
}

function getSnapshot() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? memorySnapshot;
  } catch {
    return memorySnapshot;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function saveFilters(filters: Filters) {
  memorySnapshot = JSON.stringify(filters);
  try {
    localStorage.setItem(STORAGE_KEY, memorySnapshot);
  } catch {
    // Keep filters usable for this page session when browser storage is unavailable.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Keep only category and radius locally so feed and map use the same neighborhood filters. */
export function useNeighborhoodFilters(initialRadius: number, initialCategory: Category | null) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => '');
  const saved = parseFilters(snapshot);
  const ready = snapshot !== '';
  const radius = saved.radius ?? initialRadius;
  const category = initialCategory ?? saved.category ?? null;

  return {
    radius,
    category,
    ready,
    setRadius: (nextRadius: number) => saveFilters({ radius: nextRadius, category }),
    setCategory: (nextCategory: Category | null) => saveFilters({ radius, category: nextCategory }),
    reset: () => saveFilters({ radius: initialRadius, category: null }),
    customized: radius !== initialRadius || category !== null,
  };
}
