import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { UsernameForm } from '@/components/auth/UsernameForm';
import { safeNext } from '@/lib/redirect';
import { getViewer } from '@/lib/session';

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (viewer.username) redirect(next);
  const t = await getTranslations('auth.welcome');
  const after = viewer.settings.onboarded ? next : `/onboarding?next=${encodeURIComponent(next)}`;
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-fog">{t('intro')}</p>
      </div>
      <UsernameForm next={after} />
    </main>
  );
}
