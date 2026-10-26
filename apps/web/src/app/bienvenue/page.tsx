import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { UsernameForm } from '@/components/auth/UsernameForm';
import { LogoMark } from '@/components/Logo';
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
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6">
      <div className="flex justify-center">
        <LogoMark size={56} />
      </div>
      <div className="flex flex-col gap-5 rounded-3xl border border-white/[0.07] bg-panel/80 p-6 shadow-2xl shadow-black/30">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-fog">{t('intro')}</p>
        </div>
        <UsernameForm next={after} />
      </div>
    </main>
  );
}
