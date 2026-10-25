export const RAW_BUCKET = 'raw-videos';
export const VIDEO_BUCKET = 'videos';

/** Raw uploads are `<user uuid>/<video uuid>.<ext>`; processed files are `<video uuid>.mp4|jpg`. */
const RAW_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]+$/;

export const bucketFor = (path: string): string =>
  RAW_PATH.test(path) ? RAW_BUCKET : VIDEO_BUCKET;

/** Demo clips are shared by every seeded video and must never be deleted. */
export const isProtected = (path: string): boolean => path.startsWith('demo/');

/** Groups deletable paths by bucket. */
export function groupByBucket(paths: string[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const p of paths) {
    if (isProtected(p)) continue;
    const bucket = bucketFor(p);
    out.set(bucket, [...(out.get(bucket) ?? []), p]);
  }
  return out;
}

export const rawPathFor = (userId: string, videoId: string, mime: string): string =>
  `${userId}/${videoId}.${mime === 'video/mp4' ? 'mp4' : 'webm'}`;
