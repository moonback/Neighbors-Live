import { getTranslations } from 'next-intl/server';

/** Precached by the service worker; shown when a navigation fails offline. */
export default async function OfflinePage() {
  const t = await getTranslations('common.offline');
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6 text-center"
    >
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-fog">{t('body')}</p>
    </main>
  );
}
