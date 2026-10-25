import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
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
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <h1 className="pt-4 text-2xl font-bold">{t('title')}</h1>
      <ProfileForm username={viewer.username} bio={viewer.bio} />
      <PreferencesForm
        defaultRadius={viewer.settings.defaultRadius}
        locale={viewer.settings.locale}
      />
      <PushSettings
        notifyAlerts={viewer.settings.notifyAlerts}
        defaultRadius={viewer.settings.defaultRadius}
      />
      <nav className="flex flex-wrap gap-2 text-sm">
        {viewer.role !== 'admin' && (
          <Link href="/commerce" className="rounded-xl border border-line px-3 py-2">
            {t('merchant')}
          </Link>
        )}
        {viewer.isModerator && (
          <Link href="/moderation" className="rounded-xl border border-line px-3 py-2">
            {t('moderation')}
          </Link>
        )}
        {viewer.role === 'admin' && (
          <Link href="/admin" className="rounded-xl border border-line px-3 py-2">
            {t('admin')}
          </Link>
        )}
      </nav>
      <DataSection />
      <DangerZone username={viewer.username} />
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
