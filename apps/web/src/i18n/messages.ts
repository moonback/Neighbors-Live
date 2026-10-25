import type { Locale } from './locales';

/** One JSON file per namespace in messages/<locale>/. */
export const NAMESPACES = [
  'common',
  'auth',
  'profile',
  'settings',
  'capture',
  'feed',
  'map',
  'video',
  'moderation',
  'admin',
  'merchant',
  'push',
  'onboarding',
  'legal',
] as const;

type Messages = { [key: string]: string | Messages };

function deepMerge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(override)) {
    const b = out[k];
    out[k] = typeof v === 'object' && typeof b === 'object' ? deepMerge(b, v) : v;
  }
  return out;
}

async function load(locale: Locale, ns: string): Promise<Messages> {
  try {
    return (await import(`../../messages/${locale}/${ns}.json`)).default as Messages;
  } catch {
    return {};
  }
}

/** French is the reference; other locales override it key by key (missing keys fall back to French). */
export async function loadMessages(locale: Locale): Promise<Messages> {
  const entries = await Promise.all(
    NAMESPACES.map(async (ns) => {
      const fr = await load('fr', ns);
      return [ns, locale === 'fr' ? fr : deepMerge(fr, await load(locale, ns))] as const;
    }),
  );
  return Object.fromEntries(entries);
}
