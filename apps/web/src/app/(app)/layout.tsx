import { getTranslations } from 'next-intl/server';
import { BottomNav } from '@/components/BottomNav';
import { AdminWorkspace } from '@/components/admin/AdminWorkspace';
import { OfflineQueueRunner } from '@/components/capture/OfflineQueueRunner';
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
      <main id="main" className="min-h-dvh pb-24">
        <AdminWorkspace
          enabled={Boolean(viewer?.isModerator)}
          isAdmin={viewer?.role === 'admin'}
          username={viewer?.username ?? null}
        >
          {children}
        </AdminWorkspace>
      </main>
      <BottomNav isModerator={Boolean(viewer?.isModerator)} />
      <OfflineQueueRunner />
    </>
  );
}
