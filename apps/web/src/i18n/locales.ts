export const LOCALES = ['fr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = 'NL_LOCALE';

export const isLocale = (v: string | undefined): v is Locale => LOCALES.includes(v as Locale);
