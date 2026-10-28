type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'nl-hidden-videos';

function resolveStorage(storage?: StorageLike | null): StorageLike | null {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readHiddenVideoIds(storage?: StorageLike | null): string[] {
  const target = resolveStorage(storage);
  if (!target) return [];

  try {
    const raw = target.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    return [];
  }
}

export function isVideoHidden(videoId: string, storage?: StorageLike | null): boolean {
  return readHiddenVideoIds(storage).includes(videoId);
}

export function toggleHiddenVideo(videoId: string, storage?: StorageLike | null) {
  const target = resolveStorage(storage);
  const current = readHiddenVideoIds(target);
  const exists = current.includes(videoId);
  const next = exists ? current.filter((item) => item !== videoId) : [videoId, ...current];

  if (target) {
    try {
      target.setItem(STORAGE_KEY, JSON.stringify(next));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('nl-hidden-videos-change'));
      }
    } catch {
      // Ignore quota or unavailable storage so the UI still stays usable.
    }
  }

  return { hidden: !exists, ids: next };
}
