import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { MerchantReview, NotedAction } from '@/components/admin/AdminClient';
import { inputClass, Notice } from '@/components/ui';
import { getViewer } from '@/lib/session';
import { adminClient } from '@/lib/supabase/admin';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('admin'))('title') };
}

interface Zone {
  h3_cell: string;
  active: number;
  hidden: number;
  open_reports: number;
  moderators: number;
}

const statsSchema = z.object({
  users: z.number(),
  banned: z.number(),
  active_videos: z.number(),
  hidden_videos: z.number(),
  open_reports: z.number(),
  pending_appeals: z.number(),
  pending_merchants: z.number(),
  zones: z.array(
    z.object({
      h3_cell: z.string(),
      active: z.number(),
      hidden: z.number(),
      open_reports: z.number(),
      moderators: z.number(),
    }),
  ),
});

const STAT_KEYS = [
  'users',
  'banned',
  'active_videos',
  'hidden_videos',
  'open_reports',
  'pending_appeals',
  'pending_merchants',
] as const;
const STAT_LINKS: Partial<Record<(typeof STAT_KEYS)[number], string>> = {
  active_videos: '/moderation',
  hidden_videos: '/moderation',
  open_reports: '/moderation',
  pending_appeals: '/moderation#appeals-title',
  pending_merchants: '#merchants',
};
const REVERTIBLE = new Set(['hide', 'remove', 'auto_hide', 'validate', 'warn', 'ban']);

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const viewer = await getViewer();
  if (viewer?.role !== 'admin') notFound();
  const { q } = await searchParams;
  const admin = adminClient();
  const search = (q ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20);
  const userColumns = 'id, username, role, reputation, banned_at';

  const [stats, processingVideos, merchants, users, actions, t, tk, tc, format] = await Promise.all(
    [
      admin.rpc('admin_stats', { p_admin: viewer.id }),
      admin
        .from('videos')
        .select('id, author_id, category, caption, created_at', { count: 'exact' })
        .eq('status', 'processing')
        .order('created_at', { ascending: true })
        .limit(20),
      admin
        .from('merchant_profiles')
        .select('user_id, business_name, description, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(20),
      search
        ? admin.from('profiles').select(userColumns).ilike('username', `%${search}%`).limit(20)
        : admin.from('profiles').select(userColumns).not('banned_at', 'is', null).limit(20),
      admin
        .from('moderation_actions')
        .select('id, kind, note, created_at, actor_id, target_user_id, video_id, h3_cell')
        .order('created_at', { ascending: false })
        .limit(20),
      getTranslations('admin'),
      getTranslations('moderation.decisions.kinds'),
      getTranslations('common.categories'),
      getFormatter(),
    ],
  );

  const parsedStats = statsSchema.safeParse(stats.data);
  if (
    stats.error ||
    processingVideos.error ||
    merchants.error ||
    users.error ||
    actions.error ||
    !parsedStats.success
  ) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-5 p-4 sm:p-6">
        <h1 className="pt-4 text-2xl font-bold">{t('title')}</h1>
        <Notice kind="error">{t('loadError')}</Notice>
        <Link href="/admin" className="w-fit font-semibold text-accent underline">
          {t('refresh')}
        </Link>
      </div>
    );
  }

  const actionRows = actions.data;
  const profileIds = [
    ...new Set([
      ...processingVideos.data.map((video) => video.author_id),
      ...actionRows.flatMap((action) =>
        [action.actor_id, action.target_user_id].filter((id): id is string => id !== null),
      ),
      ...merchants.data.map((merchant) => merchant.user_id),
    ]),
  ];
  const videoIds = processingVideos.data.map((video) => video.id);
  const [actionProfiles, processingJobs] = await Promise.all([
    profileIds.length > 0
      ? admin.from('profiles').select('id, username').in('id', profileIds)
      : Promise.resolve(null),
    videoIds.length > 0
      ? admin
          .from('media_jobs')
          .select('video_id, status, attempts, max_attempts, updated_at')
          .eq('kind', 'process')
          .in('video_id', videoIds)
          .order('updated_at', { ascending: false })
      : Promise.resolve(null),
  ]);
  if (actionProfiles?.error || processingJobs?.error) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-5 p-4 sm:p-6">
        <h1 className="pt-4 text-2xl font-bold">{t('title')}</h1>
        <Notice kind="error">{t('loadError')}</Notice>
        <Link href="/admin" className="w-fit font-semibold text-accent underline">
          {t('refresh')}
        </Link>
      </div>
    );
  }

  const profileNames = new Map(
    (actionProfiles?.data ?? []).map((profile) => [profile.id, profile.username]),
  );
  const latestJobByVideo = new Map<string, NonNullable<typeof processingJobs>['data'][number]>();
  for (const job of processingJobs?.data ?? []) {
    if (job.video_id && !latestJobByVideo.has(job.video_id)) {
      latestJobByVideo.set(job.video_id, job);
    }
  }
  const { zones } = parsedStats.data;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 p-4 sm:p-6">
      <header className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">
            Neighbors Live
          </p>
          <h1 className="mt-2 text-3xl font-bold">{t('title')}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fog">{t('intro')}</p>
        </div>
        <Link
          href="/moderation"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 py-2 font-semibold text-ink"
        >
          {t('openModeration')}
        </Link>
      </header>

      <section aria-labelledby="overview-title" className="flex flex-col gap-3">
        <h2 id="overview-title" className="text-lg font-semibold">
          {t('overview')}
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {STAT_KEYS.map((key) => {
            const href = STAT_LINKS[key];
            return (
              <div
                key={key}
                className={`rounded-2xl border border-line bg-panel p-4 ${href ? 'transition-colors hover:border-accent' : ''}`}
              >
                <dt className="text-sm leading-snug text-fog">{t(`stats.${key}`)}</dt>
                <dd className="mt-2 text-3xl font-bold tabular-nums">
                  {href ? (
                    <Link href={href} className="rounded-sm focus-visible:underline">
                      {parsedStats.data[key].toLocaleString('fr-FR')}
                      <span className="mt-2 block text-xs font-semibold text-accent">
                        {t('view')}
                      </span>
                    </Link>
                  ) : (
                    parsedStats.data[key].toLocaleString('fr-FR')
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section aria-labelledby="processing-videos-title" className="flex flex-col gap-3">
        <div>
          <h2 id="processing-videos-title" className="text-lg font-semibold">
            {t('processingVideos')}
            <span className="ml-2 rounded-full bg-sky-500/10 px-2 py-0.5 text-sm text-sky-700">
              {(processingVideos.count ?? processingVideos.data.length).toLocaleString('fr-FR')}
            </span>
          </h2>
          <p className="text-sm text-fog">{t('processingVideosHint')}</p>
        </div>
        {processingVideos.data.length === 0 ? (
          <p className="rounded-xl border border-line p-4 text-sm text-fog">
            {t('emptyProcessingVideos')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {processingVideos.data.map((video) => {
              const job = latestJobByVideo.get(video.id);
              const author = profileNames.get(video.author_id);
              return (
                <li
                  key={video.id}
                  className="flex flex-col gap-2 rounded-xl border border-line bg-panel p-4 sm:flex-row sm:items-center sm:justify-between"
                  data-testid="processing-video"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      <strong>{tc(video.category)}</strong> · {video.caption || '—'}
                    </p>
                    <p className="mt-1 text-xs text-fog">
                      {t('processingVideoAuthor', {
                        username: author ? `@${author}` : video.author_id.slice(0, 8),
                      })}
                      {' · '}
                      {format.dateTime(new Date(video.created_at), {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>
                  <div className="shrink-0 text-sm sm:text-right">
                    <p className="font-semibold text-sky-700">{t('videoStatusProcessing')}</p>
                    <p className="text-xs text-fog">
                      {job ? (
                        <>
                          {t(`jobStatus.${job.status}`)}
                          {' · '}
                          {t('jobAttempts', {
                            attempts: job.attempts,
                            maxAttempts: job.max_attempts,
                          })}
                        </>
                      ) : (
                        t('noProcessingJob')
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="zones" className="flex flex-col gap-3">
        <div>
          <h2 id="zones" className="text-lg font-semibold">
            {t('zones')}
          </h2>
          <p className="text-sm text-fog">{t('zonesHint')}</p>
        </div>
        {zones.length === 0 ? (
          <p className="rounded-xl border border-line p-4 text-sm text-fog">{t('emptyZones')}</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {zones.slice(0, 15).map((zone: Zone) => (
              <li
                key={zone.h3_cell}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-panel p-3"
              >
                <Link
                  href={`/moderation?cell=${zone.h3_cell}`}
                  className="shrink-0 font-mono font-semibold text-accent underline underline-offset-4"
                >
                  {t('zone', { short: zone.h3_cell.slice(3, 9) })}
                </Link>
                <span className="text-right text-sm text-fog">
                  {t('zoneRow', {
                    active: zone.active,
                    hidden: zone.hidden,
                    reports: zone.open_reports,
                    mods: zone.moderators,
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="merchants" aria-labelledby="merchants-title" className="flex flex-col gap-3">
        <div>
          <h2 id="merchants-title" className="text-lg font-semibold">
            {t('merchants')}
          </h2>
          <p className="text-sm text-fog">{t('merchantsHint')}</p>
        </div>
        {merchants.data.length === 0 ? (
          <p className="rounded-xl border border-line p-4 text-sm text-fog">
            {t('emptyMerchants')}
          </p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {merchants.data.map((merchant) => (
              <li key={merchant.user_id}>
                <MerchantReview
                  userId={merchant.user_id}
                  name={merchant.business_name}
                  applicant={profileNames.get(merchant.user_id) ?? merchant.user_id.slice(0, 8)}
                  description={merchant.description}
                  submittedAt={format.dateTime(new Date(merchant.created_at), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="users" aria-labelledby="users-title" className="flex flex-col gap-3">
        <div>
          <h2 id="users-title" className="text-lg font-semibold">
            {t('users')}
          </h2>
          <p className="text-sm text-fog">{search ? t('searchResults') : t('suspendedHint')}</p>
        </div>
        <form className="flex flex-col gap-2 sm:flex-row" role="search">
          <label htmlFor="q" className="sr-only">
            {t('search')}
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder={t('search')}
            className={inputClass}
          />
          <button
            type="submit"
            className="min-h-11 rounded-xl border border-line px-4 font-semibold hover:border-accent"
          >
            {t('searchSubmit')}
          </button>
        </form>
        {users.data.length === 0 ? (
          <p className="rounded-xl border border-line p-4 text-sm text-fog">
            {search ? t('noUsers') : t('noSuspended')}
          </p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {users.data.map((user) => (
              <li key={user.id} className="flex flex-col gap-3 rounded-xl border border-line p-4">
                <p className="text-sm">
                  <strong>@{user.username}</strong> · {t(`roles.${user.role}`)} ·{' '}
                  {t('reputation', { value: user.reputation })}
                  {user.banned_at && (
                    <span className="font-semibold text-alert"> · {t('banned')}</span>
                  )}
                </p>
                {user.id !== viewer.id && (
                  <NotedAction
                    label={user.banned_at ? t('unban') : t('ban')}
                    variant={user.banned_at ? 'secondary' : 'danger'}
                    body={{ type: 'ban', userId: user.id, banned: !user.banned_at }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="actions" className="flex flex-col gap-3">
        <div>
          <h2 id="actions" className="text-lg font-semibold">
            {t('actions')}
          </h2>
          <p className="text-sm text-fog">{t('actionsHint')}</p>
        </div>
        {actionRows.length === 0 ? (
          <p className="rounded-xl border border-line p-4 text-sm text-fog">{t('emptyActions')}</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {actionRows.map((action) => {
              const actor = action.actor_id
                ? (profileNames.get(action.actor_id) ?? action.actor_id.slice(0, 8))
                : t('system');
              const target = action.target_user_id
                ? (profileNames.get(action.target_user_id) ?? action.target_user_id.slice(0, 8))
                : null;
              return (
                <li
                  key={action.id}
                  className="flex flex-col gap-3 rounded-xl border border-line p-4"
                >
                  <div className="flex flex-col gap-1 text-sm">
                    <p className="font-semibold">
                      {tk(action.kind)} ·{' '}
                      {format.dateTime(new Date(action.created_at), {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                    <p className="text-fog">
                      {t('auditActor', { actor })}
                      {target && (
                        <>
                          {' · '}
                          {t('auditTarget', { target })}
                        </>
                      )}
                      {action.h3_cell && (
                        <>
                          {' · '}
                          <Link
                            href={`/moderation?cell=${action.h3_cell}`}
                            className="underline underline-offset-4"
                          >
                            {t('zone', { short: action.h3_cell.slice(3, 9) })}
                          </Link>
                        </>
                      )}
                      {action.video_id && (
                        <>
                          {' · '}
                          <Link
                            href={`/moderation?video=${action.video_id}`}
                            className="underline underline-offset-4"
                          >
                            {t('viewVideo')}
                          </Link>
                        </>
                      )}
                    </p>
                    {action.note && <p className="break-words text-fog">{action.note}</p>}
                  </div>
                  {REVERTIBLE.has(action.kind) && (
                    <NotedAction
                      label={t('revert')}
                      body={{ type: 'revert', actionId: action.id }}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
