import { getTranslations } from 'next-intl/server';

export default async function Home() {
  const t = await getTranslations('app');
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-bold">{t('name')}</h1>
      <p className="text-fog">{t('tagline')}</p>
    </main>
  );
}
