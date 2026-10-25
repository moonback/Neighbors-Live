import { z } from 'zod';

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  VAPID_PRIVATE_KEY: z.string().min(20),
  VAPID_SUBJECT: z.string().regex(/^(mailto:|https:\/\/)/),
  IP_HASH_SALT: z.string().min(16),
});

let cached: z.infer<typeof serverSchema> | undefined;

/** Server-only secrets. Importing this module from a client component is a bug. */
export function serverEnv(): z.infer<typeof serverSchema> {
  if (typeof window !== 'undefined') throw new Error('serverEnv() called in the browser');
  cached ??= serverSchema.parse(process.env);
  return cached;
}
