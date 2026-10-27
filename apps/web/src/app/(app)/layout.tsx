import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/AppShell';
import { AdminWorkspace } from '@/components/admin/AdminWorkspace';
import { OfflineQueueRunner } from '@/components/capture/OfflineQueueRunner';
import { profileImageUrl } from '@/lib/profile-image';
import { getViewer } from '@/lib/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('common');
  const viewer = await getViewer();
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-ink"
      >
        {t('skip')}
      </a>
      <AppShell
        isModerator={Boolean(viewer?.isModerator)}
        profileAvatar={
          viewer
            ? {
                username: viewer.username,
                color: viewer.avatarColor,
                imageUrl: profileImageUrl(viewer.avatarPath),
              }
            : null
        }
      >
        <AdminWorkspace
          enabled={Boolean(viewer?.isModerator)}
          isAdmin={viewer?.role === 'admin'}
          username={viewer?.username ?? null}
        >
          {children}
        </AdminWorkspace>
      </AppShell>
      <OfflineQueueRunner />
    </>
  );
}
