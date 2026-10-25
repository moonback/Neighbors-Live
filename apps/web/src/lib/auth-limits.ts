import { hashKey, ipKey, unwrap } from '@/lib/api';
import { adminClient } from '@/lib/supabase/admin';

/**
 * Brute-force protection for every auth endpoint: counted per IP and per e-mail address
 * (both as salted hashes, never stored raw). Raises `rate_limited` (429).
 */
export async function limitAuthAttempt(req: Request, email: string): Promise<void> {
  const admin = adminClient();
  unwrap(await admin.rpc('check_rate_limit', { p_key: ipKey(req), p_rule: 'login' }));
  unwrap(
    await admin.rpc('check_rate_limit', {
      p_key: hashKey(`email:${email.toLowerCase()}`),
      p_rule: 'login',
    }),
  );
}
