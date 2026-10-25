'use client';

import { haversineMeters, MAX_ACCURACY_M } from '@nl/shared';
import { openDB, type IDBPDatabase } from 'idb';
import type { Fix, PublishMeta } from '@/lib/publish';

/** A recording kept on the device while offline. Stored only in this browser (IndexedDB). */
export interface QueuedPublication {
  id: string;
  blob: Blob;
  meta: PublishMeta;
  fix: Fix;
  createdAt: number;
  reserved?: { videoId: string; uploadPath: string };
}

/** A queued video is republished only if the device is still within this distance of where it was filmed. */
export const MAX_DRIFT_M = 100;
/** Older recordings are dropped: hyperlocal news goes stale (alerts live 6 h). */
export const MAX_AGE_MS = 6 * 3_600_000;

let db: Promise<IDBPDatabase> | undefined;
const store = () =>
  (db ??= openDB('neighbors-live', 1, {
    upgrade(d) {
      d.createObjectStore('outbox', { keyPath: 'id' });
    },
  }));

export async function enqueue(item: QueuedPublication): Promise<void> {
  await (await store()).put('outbox', item);
}

export async function listQueued(): Promise<QueuedPublication[]> {
  return (await store()).getAll('outbox');
}

export async function removeQueued(id: string): Promise<void> {
  await (await store()).delete('outbox', id);
}

export type Verdict = 'publish' | 'drop-stale' | 'drop-moved' | 'wait-precision';

/** Decides what to do with a queued recording given the device's current position. */
export function judge(
  item: Pick<QueuedPublication, 'fix' | 'createdAt'>,
  now: number,
  current: Fix,
): Verdict {
  if (now - item.createdAt > MAX_AGE_MS) return 'drop-stale';
  if (current.accuracy > MAX_ACCURACY_M) return 'wait-precision';
  if (haversineMeters(item.fix, current) > MAX_DRIFT_M) return 'drop-moved';
  return 'publish';
}
