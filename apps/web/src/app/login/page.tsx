import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AuthForm } from '@/components/auth/AuthForms';
import { LogoMark } from '@/components/Logo';
import { safeNext } from '@/lib/redirect';
import { getViewer } from '@/lib/session';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('auth.login'))('title') };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; mode?: string }>;
}) {
  const { next, error, mode } = await searchParams;
  const target = safeNext(next);
  if (await getViewer()) redirect(target);
  const t = await getTranslations('auth');
  const tc = await getTranslations('common');
  const signup = mode === 'signup';
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="relative">
          <span aria-hidden="true" className="absolute inset-0 rounded-full bg-accent blur-2xl" />
          <span className="relative">
            <LogoMark size={64} />
          </span>
        </span>
        <p className="text-4xl font-extrabold tracking-tight">{tc('appName')}</p>
        <p className="-mt-3 text-sm font-medium text-fog">{tc('slogan')}</p>
      </div>
      <div className="flex flex-col gap-5 rounded-3xl border border-white/[0.07] bg-panel/80 p-6 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">{signup ? t('signup.title') : t('login.title')}</h1>
          <p className="text-sm text-fog">{signup ? t('signup.intro') : t('login.intro')}</p>
        </div>
        <AuthForm
          mode={signup ? 'signup' : 'login'}
          next={target}
          callbackError={error === 'callback'}
        />
      </div>
    </main>
  );
}
