/**
 * MediaRecorder formats in order of preference. Safari (iOS/macOS) records MP4/H.264,
 * Chrome/Firefox/Android record WebM. The worker transcodes everything to MP4 anyway.
 */
export const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
] as const;

export function pickMimeType(isSupported: (type: string) => boolean): string | null {
  return MIME_CANDIDATES.find((t) => isSupported(t)) ?? null;
}

/** Container type sent to the server ("video/mp4" | "video/webm"), without codecs. */
export const containerOf = (mime: string): 'video/mp4' | 'video/webm' =>
  mime.startsWith('video/mp4') ? 'video/mp4' : 'video/webm';
