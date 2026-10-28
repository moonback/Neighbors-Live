type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'nl-video-muted';
const CHANGE_EVENT = 'nl-video-muted-change';
let memoryMuted = true;

function resolveStorage(storage?: StorageLike | null): StorageLike | null {
  if (storage !== undefined) return storage;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getVideoMuted(storage?: StorageLike | null): boolean {
  const target = resolveStorage(storage);
  if (!target) return memoryMuted;

  try {
    const saved = target.getItem(STORAGE_KEY);
    return saved === null ? true : saved !== 'false';
  } catch {
    return memoryMuted;
  }
}

export function setVideoMuted(muted: boolean, storage?: StorageLike | null): void {
  memoryMuted = muted;
  const target = resolveStorage(storage);
  if (!target) return;

  try {
    target.setItem(STORAGE_KEY, String(muted));
  } catch {
    // Keep the preference available for this page session when browser storage is unavailable.
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

export function subscribeToVideoMuted(onChange: () => void): () => void {
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
