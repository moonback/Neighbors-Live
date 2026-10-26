import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Avatar } from '@/components/Avatar';
import { PushSettings } from '@/components/push/PushSettings';
import { LogoutButton } from '@/components/settings/LogoutButton';
import {
  DangerZone,
  DataSection,
  PreferencesForm,
  ProfileForm,
} from '@/components/settings/SettingsForms';
import { getViewer } from '@/lib/session';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('settings'))('title') };
}

export default async function SettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/parametres');
  if (!viewer.username) redirect('/bienvenue?next=/parametres');
  const t = await getTranslations('settings');
  const tf = await getTranslations('common.footer');
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 pb-8 sm:p-6">
      <header className="flex items-center gap-4 rounded-3xl border border-line bg-panel p-5 sm:p-7">
        <Avatar username={viewer.username} color={viewer.avatarColor} size={56} />
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
            Neighbors Live
          </p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{t('title')}</h1>
          <p className="mt-1 text-sm text-fog">@{viewer.username}</p>
        </div>
      </header>
      <section aria-label={t('title')} className="grid gap-4 lg:grid-cols-2">
        <ProfileForm username={viewer.username} bio={viewer.bio} />
        <PreferencesForm
          defaultRadius={viewer.settings.defaultRadius}
          locale={viewer.settings.locale}
        />
        <PushSettings
          notifyAlerts={viewer.settings.notifyAlerts}
          defaultRadius={viewer.settings.defaultRadius}
        />
      </section>
      <nav aria-label={t('title')} className="flex flex-wrap gap-2 text-sm">
        {viewer.role !== 'admin' && (
          <Link
            href="/commerce"
            className="inline-flex min-h-11 items-center rounded-xl border border-line bg-panel px-4 font-semibold hover:border-accent"
          >
            {t('merchant')}
          </Link>
        )}
        {viewer.isModerator && (
          <Link
            href="/moderation"
            className="inline-flex min-h-11 items-center rounded-xl border border-line bg-panel px-4 font-semibold hover:border-accent"
          >
            {t('moderation')}
          </Link>
        )}
        {viewer.role === 'admin' && (
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center rounded-xl border border-line bg-panel px-4 font-semibold hover:border-accent"
          >
            {t('admin')}
          </Link>
        )}
      </nav>
      <section className="grid gap-4 lg:grid-cols-2">
        <DataSection />
        <DangerZone username={viewer.username} />
      </section>
      <LogoutButton />
      <footer className="flex flex-wrap gap-3 pb-4 text-xs text-fog">
        <Link href="/legal/confidentialite">{tf('privacy')}</Link>
        <Link href="/legal/conditions">{tf('terms')}</Link>
        <Link href="/legal/regles">{tf('rules')}</Link>
        <Link href="/legal/contact">{tf('contact')}</Link>
      </footer>
    </div>
  );
}
