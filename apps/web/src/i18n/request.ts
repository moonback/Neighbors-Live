import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { isLocale, type Locale } from './locales';

// No locale prefix in URLs: the locale comes from a cookie set in the settings page.
export default getRequestConfig(async () => {
  const fromCookie = (await cookies()).get('NL_LOCALE')?.value;
  const locale: Locale = isLocale(fromCookie) ? fromCookie : 'fr';
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: 'Europe/Paris',
  };
});
