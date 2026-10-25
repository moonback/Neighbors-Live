import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Pool } from 'pg';
import type { Detector } from './blur/types.ts';
import { NonRetryableError } from './media/ffmpeg.ts';
import { blurAndTranscode } from './media/pipeline.ts';
import { RAW_BUCKET, VIDEO_BUCKET, removePaths } from './storage.ts';

export interface MediaJob {
  id: number;
  video_id: string | null;
  kind: 'process' | 'purge';
  payload: { raw_path?: string; paths?: string[] };
  attempts: number;
  max_attempts: number;
}

export interface JobDeps {
  db: Pool;
  storage: SupabaseClient;
  detectors: Detector[];
  detectEvery: number;
  log: (msg: string, extra?: Record<string, unknown>) => void;
}

export async function claimJob(db: Pool, workerId: string): Promise<MediaJob | null> {
  const { rows } = await db.query<MediaJob>('select * from public.claim_media_job($1)', [workerId]);
  return rows[0] ?? null;
}

async function processVideo(job: MediaJob, deps: JobDeps): Promise<void> {
  const { rows } = await deps.db.query<{ status: string; raw_path: string | null }>(
    'select status, raw_path from public.videos where id = $1',
    [job.video_id],
  );
  const video = rows[0];
  if (!video || video.status !== 'processing' || !video.raw_path) {
    // Withdrawn or already handled meanwhile: nothing to do.
    await deps.db.query('select public.complete_job($1)', [job.id]);
    return;
  }
  const dir = await mkdtemp(join(tmpdir(), 'nl-'));
  try {
    const { data, error } = await deps.storage.storage.from(RAW_BUCKET).download(video.raw_path);
    if (error || !data) throw new Error(`download failed: ${error?.message ?? 'empty'}`);
    const input = join(dir, 'input');
    const output = join(dir, 'output.mp4');
    const poster = join(dir, 'poster.jpg');
    await writeFile(input, Buffer.from(await data.arrayBuffer()));

    const started = Date.now();
    const stats = await blurAndTranscode(input, output, poster, {
      detectors: deps.detectors,
      detectEvery: deps.detectEvery,
    });

    const videoPath = `${job.video_id}.mp4`;
    const posterPath = `${job.video_id}.jpg`;
    for (const [path, file, type] of [
      [videoPath, output, 'video/mp4'],
      [posterPath, poster, 'image/jpeg'],
    ] as const) {
      const { error: upErr } = await deps.storage.storage
        .from(VIDEO_BUCKET)
        .upload(path, await readFile(file), { contentType: type, upsert: true });
      if (upErr) throw new Error(`upload ${path}: ${upErr.message}`);
    }
    await deps.db.query('select public.complete_process_job($1, $2, $3)', [
      job.id,
      videoPath,
      posterPath,
    ]);

    // The unblurred original is deleted as soon as the processed version is live.
    try {
      await removePaths(deps.storage, [video.raw_path]);
    } catch (e) {
      await deps.db.query(
        "insert into public.media_jobs (video_id, kind, payload) values ($1, 'purge', jsonb_build_object('paths', array[$2::text]))",
        [job.video_id, video.raw_path],
      );
      deps.log('raw removal deferred to a purge job', { job: job.id, error: String(e) });
    }
    deps.log('video processed', {
      job: job.id,
      video: job.video_id,
      ms: Date.now() - started,
      ...stats,
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function purge(job: MediaJob, deps: JobDeps): Promise<void> {
  await removePaths(deps.storage, job.payload.paths ?? []);
  await deps.db.query('select public.complete_job($1)', [job.id]);
  deps.log('files purged', { job: job.id, count: job.payload.paths?.length ?? 0 });
}

export async function runJob(job: MediaJob, deps: JobDeps): Promise<void> {
  try {
    if (job.kind === 'process') await processVideo(job, deps);
    else await purge(job, deps);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof NonRetryableError) {
      await deps.db.query('update public.media_jobs set attempts = max_attempts where id = $1', [
        job.id,
      ]);
    }
    const { rows } = await deps.db.query<{ fail_media_job: string }>(
      'select public.fail_media_job($1, $2)',
      [job.id, message],
    );
    deps.log('job failed', {
      job: job.id,
      kind: job.kind,
      outcome: rows[0]?.fail_media_job,
      error: message,
    });
  }
}
