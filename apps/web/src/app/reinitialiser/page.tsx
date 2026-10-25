import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { NewPasswordForm } from '@/components/auth/AuthForms';
import { Notice } from '@/components/ui';
import { getUser } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('auth.reset'))('title') };
}

/** Reached from the reset e-mail (the callback opened a recovery session). */
export default async function ResetPage() {
  const [user, t] = await Promise.all([getUser(), getTranslations('auth')]);
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold">{t('reset.title')}</h1>
      {user ? (
        <NewPasswordForm />
      ) : (
        <>
          <Notice kind="error">{t('reset.expired')}</Notice>
          <Link href="/mot-de-passe-oublie" className="text-center underline">
            {t('forgot.title')}
          </Link>
        </>
      )}
    </main>
  );
}
