import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { isLocale, LOCALE_COOKIE, type Locale } from './locales';
import { loadMessages } from './messages';

// No locale prefix in URLs: the locale comes from a cookie set in the settings page.
export default getRequestConfig(async () => {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(fromCookie) ? fromCookie : 'fr';
  return { locale, messages: await loadMessages(locale), timeZone: 'Europe/Paris' };
});
