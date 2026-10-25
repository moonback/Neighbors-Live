import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { serverEnv } from '@/lib/env.server';
import { getUser } from '@/lib/supabase/server';

export class ApiError extends Error {
  readonly status: number;
  constructor(code: string, status: number) {
    super(code);
    this.status = status;
  }
}

/** Stable error codes raised by SQL functions, mapped to HTTP statuses. */
const DB_ERRORS: Record<string, number> = {
  rate_limited: 429,
  forbidden: 403,
  banned: 403,
  conflict_of_interest: 403,
  not_merchant: 403,
  not_eligible: 403,
  not_local: 403,
  not_found: 404,
  job_not_found: 404,
  note_required: 422,
  invalid_action: 422,
  radius_invalid: 422,
  position_invalid: 422,
  position_incoherent: 422,
  accuracy_too_low: 422,
  profile_incomplete: 409,
  merchant_quota_exceeded: 429,
  video_not_awaiting_upload: 409,
  video_not_active: 409,
  not_revertible: 409,
  review_conflict: 409,
};

export function fromDbError(error: { message: string; code?: string }): ApiError {
  if (error.message in DB_ERRORS)
    return new ApiError(error.message, DB_ERRORS[error.message] ?? 400);
  if (error.code === '23505') return new ApiError('conflict', 409);
  if (error.code === '42501') return new ApiError('forbidden', 403);
  if (error.code === '23514' || error.code === '22P02') return new ApiError('invalid_input', 422);
  console.error('Unexpected database error', error);
  return new ApiError('internal', 500);
}

/** Unwraps a Supabase `{ data, error }` result, converting errors to ApiError. */
export function unwrap<T>(result: {
  data: T | null;
  error: { message: string; code?: string } | null;
}): T {
  if (result.error) throw fromDbError(result.error);
  // Without an error, PostgREST returns data (void RPCs legitimately return null).
  return result.data as T;
}

export const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

/**
 * CSRF protection for cookie-authenticated mutations: the browser always sends `Origin` on
 * cross-site and same-site POST/PATCH/DELETE; it must match the host we are served from.
 */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (!origin || !host) throw new ApiError('bad_origin', 403);
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError('bad_origin', 403);
  }
  if (originHost !== host) throw new ApiError('bad_origin', 403);
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

/** Wraps a route handler: CSRF check on mutations, uniform JSON errors. */
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) assertSameOrigin(req);
      return await handler(req, ctx);
    } catch (error) {
      if (error instanceof ApiError) return json({ error: error.message }, error.status);
      if (error instanceof ZodError) {
        return json(
          {
            error: 'invalid_input',
            issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
          },
          422,
        );
      }
      console.error(error);
      return json({ error: 'internal' }, 500);
    }
  };
}

export async function requireUser() {
  const user = await getUser();
  if (!user) throw new ApiError('unauthorized', 401);
  return user;
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError('invalid_json', 400);
  }
  return schema.parse(body);
}

/** Salted hash of the client IP: used as a rate-limit key, never stored raw. */
export const hashKey = (value: string): string =>
  createHash('sha256').update(serverEnv().IP_HASH_SALT).update(value).digest('hex').slice(0, 32);

export function ipKey(req: Request): string {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  return hashKey(`ip:${ip}`);
}
