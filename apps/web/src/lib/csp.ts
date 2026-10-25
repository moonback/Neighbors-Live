interface CspOptions {
  nonce: string;
  isDev: boolean;
  supabaseUrl: string;
  mapStyleUrl: string;
  siteUrl: string;
}

/** Strict, nonce-based Content-Security-Policy (see docs/ARCHITECTURE.md § Web). */
export function buildCsp({ nonce, isDev, supabaseUrl, mapStyleUrl, siteUrl }: CspOptions): string {
  const supabase = new URL(supabaseUrl);
  const realtime = `${supabase.protocol === 'https:' ? 'wss' : 'ws'}://${supabase.host}`;
  const tiles = new URL(mapStyleUrl).origin;
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    // Inline <style> tags carry the nonce; dev tooling injects un-nonced styles.
    'style-src': ["'self'", isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`],
    'img-src': ["'self'", 'blob:', 'data:', supabase.origin, tiles],
    'media-src': ["'self'", 'blob:', supabase.origin],
    'connect-src': ["'self'", supabase.origin, realtime, tiles],
    'font-src': ["'self'", 'data:'],
    'worker-src': ["'self'", 'blob:'],
    'child-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(' ')}`);
  if (!isDev && siteUrl.startsWith('https://')) parts.push('upgrade-insecure-requests');
  return parts.join('; ');
}
