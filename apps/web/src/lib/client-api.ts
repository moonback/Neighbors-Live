'use client';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

/** JSON fetch for our own /api routes. Errors come back as stable codes (see lib/api.ts). */
export async function api<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: 'same-origin',
      signal: init.signal,
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? 'generic', status: res.status };
    return { ok: true, data };
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    return { ok: false, error: 'network', status: 0 };
  }
}
