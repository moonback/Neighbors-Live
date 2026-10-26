import { existsSync } from 'node:fs';
import pg from 'pg';
import { createPlateDetector } from './blur/plates.ts';
import { DisabledDetector, type Detector } from './blur/types.ts';
import { YunetFaceDetector } from './blur/yunet.ts';
import { loadEnv } from './env.ts';
import { claimJob, runJob, type JobDeps } from './jobs.ts';
import { Notifier } from './notify.ts';
import { storageClient } from './storage.ts';

const env = loadEnv();
const log = (msg: string, extra: Record<string, unknown> = {}) =>
  console.log(
    JSON.stringify({ t: new Date().toISOString(), worker: env.WORKER_ID, msg, ...extra }),
  );

async function loadDetectors(): Promise<Detector[]> {
  const detectors: Detector[] = [];
  if (env.FACE_BLUR_ENABLED) {
    if (!env.FACE_MODEL_PATH || !existsSync(env.FACE_MODEL_PATH))
      throw new Error(
        `face model missing: ${env.FACE_MODEL_PATH ?? '(FACE_MODEL_PATH is not set)'}`,
      );
    detectors.push(await YunetFaceDetector.load(env.FACE_MODEL_PATH));
  } else {
    detectors.push(new DisabledDetector('face'));
  }
  if (env.PLATE_BLUR_ENABLED && env.PLATE_MODEL_PATH && !existsSync(env.PLATE_MODEL_PATH)) {
    throw new Error(`plate model missing: ${env.PLATE_MODEL_PATH}`);
  }
  detectors.push(await createPlateDetector(env.PLATE_BLUR_ENABLED, env.PLATE_MODEL_PATH));
  return detectors;
}

async function main() {
  const db = new pg.Pool({ connectionString: env.DATABASE_URL, max: env.WORKER_CONCURRENCY + 2 });
  const deps: JobDeps = {
    db,
    storage: storageClient(env),
    detectors: await loadDetectors(),
    detectEvery: env.DETECT_EVERY,
    log,
  };
  log('worker started', {
    detectors: deps.detectors.map((d) => `${d.name}:${d.enabled ? 'on' : 'off'}`),
  });

  let wake: (() => void) | undefined;
  const nap = (ms: number) =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms);
      wake = () => {
        clearTimeout(timer);
        resolve();
      };
    });

  // LISTEN gives near-instant pickup; polling covers missed notifications and scheduled retries.
  const listener = new pg.Client({ connectionString: env.DATABASE_URL });
  await listener.connect();
  await listener.query('listen media_jobs');
  listener.on('notification', () => wake?.());

  let stopping = false;
  const stop = () => {
    stopping = true;
    wake?.();
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);

  const jobLoop = async (slot: number) => {
    while (!stopping) {
      try {
        const job = await claimJob(db, `${env.WORKER_ID}#${slot}`);
        if (job) await runJob(job, deps);
        else await nap(env.POLL_INTERVAL_MS);
      } catch (error) {
        log('job loop error', { error: String(error) });
        await nap(env.POLL_INTERVAL_MS);
      }
    }
  };

  const notifier = new Notifier(db, env, log);
  const outboxLoop = async () => {
    while (!stopping) {
      try {
        while ((await notifier.drain()) > 0) {
          /* drain until empty */
        }
      } catch (error) {
        log('outbox error', { error: String(error) });
      }
      await new Promise((r) => setTimeout(r, env.OUTBOX_INTERVAL_MS));
    }
  };

  await Promise.all([
    ...Array.from({ length: env.WORKER_CONCURRENCY }, (_, i) => jobLoop(i)),
    outboxLoop(),
  ]);
  await listener.end();
  await db.end();
  log('worker stopped');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
