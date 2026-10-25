import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AuthForm } from '@/components/auth/AuthForms';
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
  const signup = mode === 'signup';
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{signup ? t('signup.title') : t('login.title')}</h1>
        <p className="text-fog">{signup ? t('signup.intro') : t('login.intro')}</p>
      </div>
      <AuthForm
        mode={signup ? 'signup' : 'login'}
        next={target}
        callbackError={error === 'callback'}
      />
    </main>
  );
}
