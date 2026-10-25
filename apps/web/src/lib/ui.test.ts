import { CATEGORY_COLORS } from '@nl/shared';
import { describe, expect, it } from 'vitest';
import { initialsColor } from '@/components/Avatar';
import { buildCsp } from './csp';
import { safeNext } from './redirect';

const lum = (hex: string) => {
  const ch = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(1) + 0.7152 * ch(3) + 0.0722 * ch(5);
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};

describe('accessibility of generated colours', () => {
  it('category chips keep white text at WCAG AA (4.5:1)', () => {
    for (const color of Object.values(CATEGORY_COLORS)) {
      expect(contrast('#ffffff', color)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('avatar initials pick the readable text colour', () => {
    for (const bg of [
      '#ef4444',
      '#f97316',
      '#d97706',
      '#16a34a',
      '#0d9488',
      '#0284c7',
      '#4f46e5',
    ]) {
      expect(contrast(initialsColor(bg), bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('csp', () => {
  const base = {
    nonce: 'abc',
    supabaseUrl: 'https://p.supabase.co',
    mapStyleUrl: 'https://tiles.example.org/styles/x',
    siteUrl: 'https://app.example.org',
  };
  it('is strict in production', () => {
    const csp = buildCsp({ ...base, isDev: false });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).toContain("style-src 'self' 'nonce-abc'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain('connect-src');
    expect(csp).toContain('wss://p.supabase.co');
    expect(csp).toContain('upgrade-insecure-requests');
  });
  it('relaxes eval only in development', () => {
    expect(buildCsp({ ...base, isDev: true })).toContain("'unsafe-eval'");
  });
});

describe('safeNext (open redirect protection)', () => {
  it('keeps same-site paths and rejects others', () => {
    expect(safeNext('/carte?x=1')).toBe('/carte?x=1');
    expect(safeNext('//evil.example')).toBe('/');
    expect(safeNext('https://evil.example')).toBe('/');
    expect(safeNext('/\\evil.example')).toBe('/');
    expect(safeNext(null)).toBe('/');
  });
});
