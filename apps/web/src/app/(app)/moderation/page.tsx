import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  AppealsQueue,
  ApplyForm,
  ModerationQueue,
  type AppealItem,
  type QueueItem,
} from '@/components/moderation/ModerationClient';
import { signMedia } from '@/lib/media';
import { getViewer } from '@/lib/session';
import { adminClient } from '@/lib/supabase/admin';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('moderation'))('title') };
}

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ cell?: string; video?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/moderation');
  const t = await getTranslations('moderation');
  const admin = adminClient();

  if (!viewer.isModerator) {
    const [eligible, own] = await Promise.all([
      admin.rpc('moderator_eligible', { p_user: viewer.id }),
      admin
        .from('videos')
        .select('h3_cell')
        .eq('author_id', viewer.id)
        .in('status', ['active', 'expired']),
    ]);
    const cells = [...new Set((own.data ?? []).map((v) => v.h3_cell))];
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 p-4">
        <h1 className="pt-4 text-2xl font-bold">{t('title')}</h1>
        <p className="text-fog">{t('intro')}</p>
        <ApplyForm eligible={Boolean(eligible.data)} cells={cells} />
      </div>
    );
  }

  // Zones: the moderator's cells (admins: every cell with something to review).
  const pendingQuery = admin
    .from('videos')
    .select('h3_cell')
    .or('status.eq.hidden,and(status.eq.active,report_count.gt.0)');
  const { data: pendingRows } =
    viewer.role === 'admin'
      ? await pendingQuery
      : await pendingQuery.in('h3_cell', viewer.moderatedCells);
  const pending = new Map<string, number>();
  for (const r of pendingRows ?? []) pending.set(r.h3_cell, (pending.get(r.h3_cell) ?? 0) + 1);
  const cells = [...new Set([...pending.keys(), ...viewer.moderatedCells])].sort(
    (a, b) => (pending.get(b) ?? 0) - (pending.get(a) ?? 0),
  );
  const { cell: requestedCell, video } = await searchParams;
  let requested = requestedCell;
  if (video && /^[0-9a-f-]{36}$/.test(video)) {
    // Deep link from a notification or the admin dashboard: open the video's zone.
    const { data } = await admin.from('videos').select('h3_cell').eq('id', video).maybeSingle();
    requested = data?.h3_cell ?? requested;
    if (requested && viewer.role === 'admin' && !cells.includes(requested))
      cells.unshift(requested);
  }
  const cell = requested && cells.includes(requested) ? requested : cells[0];

  const [queueRes, appealsRes] = await Promise.all([
    cell ? admin.rpc('moderation_queue', { p_actor: viewer.id, p_cell: cell }) : null,
    admin.rpc('appeals_queue', { p_reviewer: viewer.id }),
  ]);
  const queueRows = queueRes?.data ?? [];
  const appealRows = appealsRes.data ?? [];
  const urls = await signMedia(
    [...queueRows, ...appealRows].flatMap((r) => [r.video_path, r.poster_path]),
  );
  const url = (p: string | null) => (p ? (urls.get(p) ?? null) : null);

  const queue: QueueItem[] = queueRows.map((r) => ({
    videoId: r.video_id,
    category: r.category,
    caption: r.caption,
    status: r.status,
    hiddenReason: r.hidden_reason,
    reportCount: r.report_count,
    reasons: r.reasons ?? [],
    author: r.author_username,
    videoUrl: url(r.video_path),
    posterUrl: url(r.poster_path),
  }));
  const appeals: AppealItem[] = appealRows.map((a) => ({
    appealId: a.appeal_id,
    reason: a.reason,
    actionKind: a.action_kind,
    actionNote: a.action_note,
    caption: a.caption,
    videoUrl: url(a.video_path),
    posterUrl: url(a.poster_path),
  }));

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5 p-4">
      <h1 className="pt-4 text-2xl font-bold">{t('title')}</h1>
      <p className="text-sm text-fog">{t('intro')}</p>
      <nav aria-label={t('zones')} className="flex flex-wrap gap-2">
        {cells.slice(0, 12).map((c) => (
          <Link
            key={c}
            href={`/moderation?cell=${c}`}
            aria-current={c === cell ? 'page' : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm ${c === cell ? 'border-accent bg-accent text-ink' : 'border-line'}`}
          >
            {t('zone', { short: c.slice(3, 9) })} {pending.get(c) ? `(${pending.get(c)})` : ''}
          </Link>
        ))}
      </nav>
      <section aria-labelledby="queue-title" className="flex flex-col gap-3">
        <h2 id="queue-title" className="text-lg font-semibold">
          {t('queue')}
        </h2>
        <ModerationQueue items={queue} />
      </section>
      <section aria-labelledby="appeals-title" className="flex flex-col gap-3">
        <h2 id="appeals-title" className="text-lg font-semibold">
          {t('appeals')}
        </h2>
        <AppealsQueue items={appeals} />
      </section>
    </div>
  );
}
