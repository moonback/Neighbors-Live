import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { BoxTracker } from '../blur/tracker.ts';
import { pixelate } from '../blur/pixelate.ts';
import type { Box, Detector, Frame } from '../blur/types.ts';
import { FPS, MAX_DURATION_S, NonRetryableError, probe, run, targetSize } from './ffmpeg.ts';

export interface PipelineOptions {
  detectors: Detector[];
  /** Run detectors every N frames; the tracker covers frames in between. */
  detectEvery: number;
  expectedDurationS?: number;
  onProgress?: (percent: number) => void;
}

export interface PipelineResult {
  frames: number;
  detectedFrames: number;
  maxBoxes: number;
}

/**
 * raw (WebM/MP4, any codec) → decoded RGB frames at 30 fps (1080×1920 portrait canvas) →
 * detection + tracking + pixelation in memory → H.264/AAC MP4 (+faststart) and a JPEG poster
 * taken from the blurred output. The unblurred pixels never reach the output file.
 */
export async function blurAndTranscode(
  input: string,
  output: string,
  poster: string,
  opts: PipelineOptions,
): Promise<PipelineResult> {
  const info = await probe(input);
  if (info.durationS > MAX_DURATION_S) throw new NonRetryableError(`too long: ${info.durationS}s`);
  const { width, height } = targetSize(info.width, info.height, info.rotation);
  const frameBytes = width * height * 3;
  const maxFrames = MAX_DURATION_S * FPS;
  const expectedDurationS = opts.expectedDurationS ?? (info.durationS || MAX_DURATION_S);
  const totalFrames = Math.max(1, Math.min(maxFrames, Math.round(expectedDurationS * FPS)));

  // ffmpeg auto-rotates by default, so decoded frames are already upright.
  const decoder = spawn(
    'ffmpeg',
    [
      '-v',
      'error',
      '-i',
      input,
      '-vf',
      `fps=${FPS},scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=bicubic,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=rgb24`,
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      'pipe:1',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  const encoderArgs = [
    '-v',
    'error',
    '-y',
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgb24',
    '-s',
    `${width}x${height}`,
    '-framerate',
    String(FPS),
    '-i',
    'pipe:0',
  ];
  if (info.hasAudio)
    encoderArgs.push(
      '-i',
      input,
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      '-c:a',
      'aac',
      '-b:a',
      '96k',
      '-ac',
      '2',
    );
  else encoderArgs.push('-map', '0:v:0');
  encoderArgs.push(
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '26',
    '-pix_fmt',
    'yuv420p',
    '-profile:v',
    'main',
    '-movflags',
    '+faststart',
    '-shortest',
    output,
  );
  const encoder = spawn('ffmpeg', encoderArgs, { stdio: ['pipe', 'ignore', 'pipe'] });

  const errors: string[] = [];
  decoder.stderr.on('data', (d: Buffer) => errors.push(d.toString()));
  encoder.stderr.on('data', (d: Buffer) => errors.push(d.toString()));
  const encoderClosed = once(encoder, 'close');
  const decoderClosed = once(decoder, 'close');

  const trackers = opts.detectors.filter((d) => d.enabled).map((d) => ({ d, t: new BoxTracker() }));
  let pending: Buffer = Buffer.alloc(0);
  const result: PipelineResult = { frames: 0, detectedFrames: 0, maxBoxes: 0 };
  let lastReportedProgress = 0;

  const processFrame = async (data: Buffer) => {
    const frame: Frame = { data, width, height };
    const runDetector = result.frames % opts.detectEvery === 0;
    const boxes: Box[] = [];
    for (const { d, t } of trackers) {
      boxes.push(...t.step(runDetector ? await d.detect(frame) : null));
    }
    if (runDetector) result.detectedFrames += 1;
    result.maxBoxes = Math.max(result.maxBoxes, boxes.length);
    pixelate(frame, boxes);
    result.frames += 1;
    const progress = Math.min(100, Math.floor((result.frames / totalFrames) * 100));
    if (progress >= lastReportedProgress + 5) {
      lastReportedProgress = progress;
      opts.onProgress?.(progress);
    }
    if (!encoder.stdin.write(data)) await once(encoder.stdin, 'drain');
  };

  for await (const chunk of decoder.stdout) {
    pending = pending.length ? Buffer.concat([pending, chunk as Buffer]) : (chunk as Buffer);
    while (pending.length >= frameBytes) {
      const frame = Buffer.from(pending.subarray(0, frameBytes));
      pending = pending.subarray(frameBytes);
      if (result.frames >= maxFrames) break;
      await processFrame(frame);
    }
  }
  encoder.stdin.end();
  const [[decCode], [encCode]] = (await Promise.all([decoderClosed, encoderClosed])) as [
    [number],
    [number],
  ];
  if (decCode !== 0 || encCode !== 0)
    throw new Error(`ffmpeg failed (${decCode}/${encCode}): ${errors.join('').slice(-1500)}`);
  if (result.frames === 0) throw new NonRetryableError('no frames decoded');

  await run('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-ss',
    '0.5',
    '-i',
    output,
    '-frames:v',
    '1',
    '-q:v',
    '4',
    poster,
  ]);
  return result;
}
