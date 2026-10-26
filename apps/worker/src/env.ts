import { hostname } from 'node:os';
import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

const schema = z
  .object({
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//),
    SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(20),
    VAPID_PRIVATE_KEY: z.string().min(20),
    VAPID_SUBJECT: z.string().regex(/^(mailto:|https:\/\/)/),
    NEXT_PUBLIC_SITE_URL: z.url().default('http://localhost:3000'),
    WORKER_ID: z.string().min(1).default(hostname()),
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(1),
    DETECT_EVERY: z.coerce.number().int().min(1).max(10).default(2),
    FACE_BLUR_ENABLED: bool.default(true),
    FACE_MODEL_PATH: z
      .string()
      .optional()
      .transform((v) => v?.trim() || undefined)
      .default('models/face_detection_yunet_2023mar.onnx'),
    PLATE_BLUR_ENABLED: bool.default(false),
    PLATE_MODEL_PATH: z
      .string()
      .trim()
      .optional()
      .transform((v) => v || undefined),
    POLL_INTERVAL_MS: z.coerce.number().int().min(500).default(10_000),
    OUTBOX_INTERVAL_MS: z.coerce.number().int().min(500).default(15_000),
  })
  .superRefine((env, ctx) => {
    if (env.FACE_BLUR_ENABLED && !env.FACE_MODEL_PATH) {
      ctx.addIssue({
        code: 'custom',
        path: ['FACE_MODEL_PATH'],
        message: 'FACE_MODEL_PATH is required when FACE_BLUR_ENABLED=true',
      });
    }
    if (env.PLATE_BLUR_ENABLED && !env.PLATE_MODEL_PATH) {
      ctx.addIssue({
        code: 'custom',
        path: ['PLATE_MODEL_PATH'],
        message: 'PLATE_MODEL_PATH is required when PLATE_BLUR_ENABLED=true',
      });
    }
  });

export type WorkerEnv = z.infer<typeof schema>;

/** Validated at startup: the worker refuses to run with an incomplete configuration. */
export const loadEnv = (source: NodeJS.ProcessEnv = process.env): WorkerEnv => schema.parse(source);
