import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { Inter } from 'next/font/google';
import { getLocale, getTranslations } from 'next-intl/server';
import { PwaShell } from '@/components/pwa/PwaShell';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common');
  return {
    title: { default: t('appName'), template: `%s · ${t('appName')}` },
    description: t('tagline'),
    applicationName: t('appName'),
    appleWebApp: { capable: true, title: t('appName'), statusBarStyle: 'black-translucent' },
    formatDetection: { telephone: false },
    icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  };
}

export const viewport: Viewport = {
  themeColor: '#070a1c',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={inter.variable}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider>
          <ThemeProvider>
            <PwaShell
              disable={
                process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_SW_IN_DEV !== '1'
              }
            >
              {children}
            </PwaShell>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
