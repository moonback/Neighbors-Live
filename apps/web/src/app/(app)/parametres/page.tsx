import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Avatar } from '@/components/Avatar';
import { PushSettings } from '@/components/push/PushSettings';
import { LogoutButton } from '@/components/settings/LogoutButton';
import { ProfileImagesForm } from '@/components/settings/ProfileImagesForm';
import { profileImageUrl } from '@/lib/profile-image';
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
  const tc = await getTranslations('common');
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 pb-8 sm:p-6">
      <header className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Link
            href="/me"
            aria-label={tc('actions.back')}
            className="glass flex h-11 w-11 items-center justify-center rounded-full"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M19 12H5m6-6l-6 6 6 6" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
        </div>
        <Link
          href="/me"
          className="flex items-center gap-4 rounded-3xl border border-white/[0.07] bg-panel/80 p-4 transition hover:border-accent/50"
        >
          <span className="rounded-full bg-accent p-0.5">
            <Avatar
              username={viewer.username}
              color={viewer.avatarColor}
              size={52}
              src={profileImageUrl(viewer.avatarPath)}
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">@{viewer.username}</span>
            <span className="block text-sm text-fog">{tc('nav.profile')}</span>
          </span>
          <Chevron />
        </Link>
      </header>
      <section aria-label={t('title')} className="grid gap-4 lg:grid-cols-2">
        <ProfileForm username={viewer.username} bio={viewer.bio} />
        <ProfileImagesForm
          userId={viewer.id}
          username={viewer.username}
          avatarColor={viewer.avatarColor}
          avatarPath={viewer.avatarPath}
          coverPath={viewer.coverPath}
        />
        <PreferencesForm
          defaultRadius={viewer.settings.defaultRadius}
          locale={viewer.settings.locale}
        />
        <PushSettings
          notifyAlerts={viewer.settings.notifyAlerts}
          defaultRadius={viewer.settings.defaultRadius}
        />
      </section>
      <nav
        aria-label={t('title')}
        className="flex flex-col divide-y divide-white/[0.06] overflow-hidden rounded-3xl border border-white/[0.07] bg-panel/80 text-sm"
      >
        {viewer.role !== 'admin' && (
          <SettingsLink href="/commerce" icon="M4 9l1.5-5h13L20 9M4 9v11h16V9M10 20v-5h4v5">
            {t('merchant')}
          </SettingsLink>
        )}
        {viewer.isModerator && (
          <SettingsLink
            href="/moderation"
            icon="M12 3l9 4v5c0 5-3.8 8-9 9-5.2-1-9-4-9-9V7zM8 12l2.5 2.5L16 9"
          >
            {t('moderation')}
          </SettingsLink>
        )}
        {viewer.role === 'admin' && (
          <SettingsLink href="/admin" icon="M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z">
            {t('admin')}
          </SettingsLink>
        )}
        <SettingsLink href="/legal/regles" icon="M12 3l9 4v5c0 5-3.8 8-9 9-5.2-1-9-4-9-9V7z">
          {tf('rules')}
        </SettingsLink>
        <SettingsLink
          href="/legal/contact"
          icon="M12 21a9 9 0 100-18 9 9 0 000 18zm0-5v.01M12 13a2 2 0 10-2-2"
        >
          {tf('contact')}
        </SettingsLink>
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

function Chevron() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0 text-fog"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function SettingsLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center gap-3 px-4 font-medium transition hover:bg-white/5"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d={icon} />
        </svg>
      </span>
      <span className="flex-1">{children}</span>
      <Chevron />
    </Link>
  );
}
