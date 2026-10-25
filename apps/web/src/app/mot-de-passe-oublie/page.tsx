import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ForgotForm } from '@/components/auth/AuthForms';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('auth.forgot'))('title') };
}

export default async function ForgotPage() {
  const t = await getTranslations('auth.forgot');
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-fog">{t('intro')}</p>
      </div>
      <ForgotForm />
      <Link href="/login" className="text-center text-sm underline">
        {t('back')}
      </Link>
    </main>
  );
}
