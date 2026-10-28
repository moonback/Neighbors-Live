import { HiddenVideos } from '@/components/profile/HiddenVideos';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getViewer } from '@/lib/session';

export default async function HiddenVideosPage() {
  const [viewer, t] = await Promise.all([getViewer(), getTranslations('profile')]);
  if (!viewer) redirect('/login?next=/me/masquees');
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-4 pb-8 sm:p-6">
      <Link
        href="/me"
        className="min-h-11 w-fit rounded-lg text-sm font-semibold text-fog underline-offset-4 hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {t('backToProfile')}
      </Link>
      <h1 className="text-2xl font-bold">{t('hiddenVideos')}</h1>
      <HiddenVideos />
    </main>
  );
}
