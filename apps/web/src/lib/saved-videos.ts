import { api } from '@/lib/client-api';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export type SavedVideoRecord = {
  id: string;
  category?: string | null;
  caption?: string | null;
  posterUrl?: string | null;
  authorName?: string | null;
  savedAt: number;
  status?: string | null;
  publishedAt?: string | null;
  expiresAt?: string | null;
};

const STORAGE_KEY = 'nl-saved-videos';

function resolveStorage(storage?: StorageLike | null): StorageLike | null {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeSavedVideos(raw: unknown): SavedVideoRecord[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry): SavedVideoRecord | null => {
      if (typeof entry === 'string') {
        return { id: entry, savedAt: Date.now() };
      }
      if (!entry || typeof entry !== 'object') return null;
      const candidate = entry as Partial<SavedVideoRecord> & { id?: unknown };
      if (typeof candidate.id !== 'string' || !candidate.id.trim()) return null;
      return {
        id: candidate.id,
        category: typeof candidate.category === 'string' ? candidate.category : undefined,
        caption: typeof candidate.caption === 'string' ? candidate.caption : undefined,
        posterUrl: typeof candidate.posterUrl === 'string' ? candidate.posterUrl : undefined,
        authorName: typeof candidate.authorName === 'string' ? candidate.authorName : undefined,
        savedAt: typeof candidate.savedAt === 'number' ? candidate.savedAt : Date.now(),
        status: typeof candidate.status === 'string' ? candidate.status : null,
        publishedAt: typeof candidate.publishedAt === 'string' ? candidate.publishedAt : null,
        expiresAt: typeof candidate.expiresAt === 'string' ? candidate.expiresAt : null,
      };
    })
    .filter((entry): entry is SavedVideoRecord => entry !== null);
}

export function readSavedVideos(storage?: StorageLike | null): SavedVideoRecord[] {
  const target = resolveStorage(storage);
  if (!target) return [];

  try {
    const raw = target.getItem(STORAGE_KEY);
    if (!raw) return [];
    return normalizeSavedVideos(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function readSavedVideoIds(storage?: StorageLike | null): string[] {
  return readSavedVideos(storage).map((video) => video.id);
}

export function isVideoSaved(videoId: string, storage?: StorageLike | null): boolean {
  return readSavedVideoIds(storage).includes(videoId);
}

export function toggleSavedVideo(
  videoId: string,
  detailsOrStorage?: Partial<Omit<SavedVideoRecord, 'id' | 'savedAt'>> | StorageLike | null,
  storage?: StorageLike | null,
) {
  const target = resolveStorage(
    storage ?? (detailsOrStorage && 'getItem' in detailsOrStorage ? detailsOrStorage : null),
  );
  const details = detailsOrStorage && !('getItem' in detailsOrStorage) ? detailsOrStorage : {};
  const current = readSavedVideos(target);
  const existsIndex = current.findIndex((item) => item.id === videoId);
  const exists = existsIndex >= 0;
  const next = exists
    ? current.filter((item) => item.id !== videoId)
    : [{ id: videoId, savedAt: Date.now(), ...details }, ...current];

  if (target) {
    try {
      target.setItem(STORAGE_KEY, JSON.stringify(next));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('nl-saved-videos-change'));
      }
    } catch {
      // Ignore quota or unavailable storage so the UI still stays usable.
    }
  }

  return {
    saved: !exists,
    ids: next.map((item) => item.id),
    item: next.find((item) => item.id === videoId) ?? null,
    items: next,
  };
}

export async function fetchSavedVideos(): Promise<SavedVideoRecord[]> {
  const res = await api<{ videos: SavedVideoRecord[] }>('/api/me/saved-videos');
  if (!res.ok) throw new Error(`Could not load saved videos: ${res.error}`);
  return res.data.videos;
}

export async function fetchIsVideoSaved(videoId: string): Promise<boolean> {
  const res = await api<{ saved: boolean }>(
    `/api/me/saved-videos?videoId=${encodeURIComponent(videoId)}`,
  );
  if (!res.ok) throw new Error(`Could not read saved video state: ${res.error}`);
  return res.data.saved;
}

export async function toggleSavedVideoServer(videoId: string) {
  const currentSaved = await fetchIsVideoSaved(videoId);
  const res = await api<{ saved: boolean; ids: string[]; item: SavedVideoRecord | null }>(
    '/api/me/saved-videos',
    {
      method: currentSaved ? 'DELETE' : 'POST',
      body: { videoId },
    },
  );
  if (!res.ok) throw new Error(`Could not update saved video state: ${res.error}`);
  return res.data;
}
