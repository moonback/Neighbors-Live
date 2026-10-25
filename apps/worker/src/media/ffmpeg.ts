import { spawn } from 'node:child_process';
import { once } from 'node:events';
import type { Readable } from 'node:stream';

export interface Probe {
  width: number;
  height: number;
  durationS: number;
  hasAudio: boolean;
  rotation: number;
}

/** Errors that retrying cannot fix (corrupt or out-of-spec media): the job fails at once. */
export class NonRetryableError extends Error {}

async function collect(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

export async function run(cmd: string, args: string[]): Promise<void> {
  const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  const stderr = collect(child.stderr);
  const [code] = (await once(child, 'close')) as [number];
  if (code !== 0) throw new Error(`${cmd} exited ${code}: ${(await stderr).slice(-1500)}`);
}

export async function probe(path: string): Promise<Probe> {
  const child = spawn('ffprobe', [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_streams',
    '-show_format',
    path,
  ]);
  const [out, err] = await Promise.all([collect(child.stdout), collect(child.stderr)]);
  const [code] = (await once(child, 'close')) as [number];
  if (code !== 0) throw new NonRetryableError(`unreadable media: ${err.slice(-500)}`);
  const info = JSON.parse(out) as {
    streams: Array<{
      codec_type: string;
      width?: number;
      height?: number;
      tags?: { rotate?: string };
      side_data_list?: Array<{ rotation?: number }>;
    }>;
    format: { duration?: string };
  };
  const video = info.streams.find((s) => s.codec_type === 'video');
  if (!video?.width || !video.height) throw new NonRetryableError('no video stream');
  const sideRotation = video.side_data_list?.find((d) => d.rotation !== undefined)?.rotation;
  return {
    width: video.width,
    height: video.height,
    // MediaRecorder WebM files often lack a duration header; 0 means "unknown".
    durationS: Number(info.format.duration ?? 0) || 0,
    hasAudio: info.streams.some((s) => s.codec_type === 'audio'),
    rotation: Number(video.tags?.rotate ?? sideRotation ?? 0),
  };
}

/** Output size: at most 720p on the short side, even dimensions (H.264 requirement). */
export function targetSize(
  width: number,
  height: number,
  rotation: number,
): { width: number; height: number } {
  const rotated = Math.abs(rotation) % 180 === 90;
  const w = rotated ? height : width;
  const h = rotated ? width : height;
  const scale = Math.min(1, 720 / Math.min(w, h), 1280 / Math.max(w, h));
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2);
  return { width: even(w), height: even(h) };
}

export const FPS = 30;
export const MAX_DURATION_S = 31;
