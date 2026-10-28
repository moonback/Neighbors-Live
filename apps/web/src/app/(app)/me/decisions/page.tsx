import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Decisions, type Decision } from '@/components/moderation/Decisions';
import { getViewer } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

const APPEALABLE = new Set(['hide', 'remove', 'warn', 'auto_hide']);

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('moderation.decisions'))('title') };
}

export default async function DecisionsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/me/decisions');
  const supabase = await createClient();
  // RLS: only decisions targeting the viewer and their own appeals are visible.
  const [actions, appeals, t] = await Promise.all([
    supabase
      .from('moderation_actions')
      .select('id, kind, note, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('appeals').select('action_id, status'),
    getTranslations('moderation.decisions'),
  ]);
  const appealByAction = new Map((appeals.data ?? []).map((a) => [a.action_id, a.status]));
  const items: Decision[] = (actions.data ?? []).map((a) => ({
    id: a.id,
    kind: a.kind,
    note: a.note,
    createdAt: a.created_at,
    appealStatus: appealByAction.get(a.id) ?? null,
    appealable: APPEALABLE.has(a.kind),
  }));
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <h1 className="pt-4 text-2xl font-bold">{t('title')}</h1>
      {actions.error || appeals.error ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-950/20 p-4 text-sm text-white">
          <p role="alert">{t('loadError')}</p>
          <a href="/me/decisions" className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
            {t('retry')}
          </a>
        </div>
      ) : (
        <Decisions items={items} />
      )}
    </div>
  );
}
