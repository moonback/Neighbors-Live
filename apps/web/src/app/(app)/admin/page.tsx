import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { z } from 'zod';
import {
  MediaProcessingSettings,
  MerchantReview,
  NotedAction,
  type MediaSettings,
} from '@/components/admin/AdminClient';
import { ProcessingRefresh } from '@/components/admin/ProcessingRefresh';
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

const mediaSettingsSchema = z.object({
  faceBlurEnabled: z.boolean(),
  plateBlurEnabled: z.boolean(),
  detectEvery: z.number().int().min(1).max(10),
  faceMinScore: z.number().min(0.05).max(0.95),
  plateMinScore: z.number().min(0.05).max(0.95),
});

const MEDIA_CONFIG_KEYS = [
  'media_face_blur_enabled',
  'media_plate_blur_enabled',
  'media_detect_every',
  'media_face_min_score',
  'media_plate_min_score',
] as const;

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
const STAT_STYLE: Record<(typeof STAT_KEYS)[number], { tile: string; icon: string }> = {
  users: {
    tile: 'bg-gradient-to-br from-violet-500 to-indigo-600',
    icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-8 9a8 8 0 0116 0',
  },
  banned: {
    tile: 'bg-gradient-to-br from-rose-500 to-red-600',
    icon: 'M12 21a9 9 0 100-18 9 9 0 000 18zM5.6 5.6l12.8 12.8',
  },
  active_videos: {
    tile: 'bg-gradient-to-br from-sky-400 to-blue-600',
    icon: 'M3 7h12v10H3zM15 10l6-3v10l-6-3',
  },
  hidden_videos: {
    tile: 'bg-gradient-to-br from-slate-500 to-slate-700',
    icon: 'M3 3l18 18M10.6 6.1A9.8 9.8 0 0112 6c5 0 9 6 9 6a16 16 0 01-2.6 3.2M6.6 6.6C4.3 8.1 3 12 3 12s4 6 9 6a8.6 8.6 0 004.4-1.2',
  },
  open_reports: {
    tile: 'bg-gradient-to-br from-emerald-400 to-green-600',
    icon: 'M5 21V4h11l-1.5 4L16 12H5',
  },
  pending_appeals: {
    tile: 'bg-gradient-to-br from-fuchsia-500 to-pink-600',
    icon: 'M12 3v18M5 7h14M5 7l-3 6a3 3 0 006 0zM19 7l-3 6a3 3 0 006 0z',
  },
  pending_merchants: {
    tile: 'bg-gradient-to-br from-amber-400 to-orange-500',
    icon: 'M4 9l1.5-5h13L20 9M4 9v11h16V9M10 20v-5h4v5',
  },
};
const REVERTIBLE = new Set(['hide', 'remove', 'auto_hide', 'validate', 'warn', 'ban']);
const AUDIT_KINDS = [
  'validate',
  'hide',
  'remove',
  'warn',
  'auto_hide',
  'revert',
  'ban',
  'unban',
  'appeal_upheld',
  'appeal_rejected',
] as const;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    auditPage?: string;
    action?: string;
    actor?: string;
    target?: string;
    since?: string;
  }>;
}) {
  const viewer = await getViewer();
  if (viewer?.role !== 'admin') notFound();
  const {
    q,
    page: pageParam,
    auditPage: auditPageParam,
    action,
    actor,
    target,
    since,
  } = await searchParams;
  const admin = adminClient();
  const search = (q ?? '')
    .trim()
    .replace(/[^a-z0-9_-]/gi, '')
    .slice(0, 80);
  const page = /^\d+$/.test(pageParam ?? '') ? Math.min(Number(pageParam), 1000) : 0;
  const pageSize = 20;
  const userOffset = page * pageSize;
  const auditPage = /^\d+$/.test(auditPageParam ?? '') ? Math.min(Number(auditPageParam), 1000) : 0;
  const auditOffset = auditPage * pageSize;
  const auditKind = AUDIT_KINDS.find((kind) => kind === action);
  const auditActor = /^[0-9a-f-]{36}$/i.test(actor ?? '') ? actor : undefined;
  const auditTarget = ['user', 'video', 'zone', 'system'].includes(target ?? '') ? target : '';
  const auditSince =
    /^\d{4}-\d{2}-\d{2}$/.test(since ?? '') && !Number.isNaN(Date.parse(`${since}T00:00:00.000Z`))
      ? since
      : undefined;
  const userColumns = 'id, username, role, reputation, banned_at';

  let auditQuery = admin
    .from('moderation_actions')
    .select('id, kind, note, created_at, actor_id, target_user_id, video_id, h3_cell', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (auditKind) auditQuery = auditQuery.eq('kind', auditKind);
  if (auditActor) auditQuery = auditQuery.eq('actor_id', auditActor);
  if (auditSince) auditQuery = auditQuery.gte('created_at', `${auditSince}T00:00:00.000Z`);
  if (auditTarget === 'user') auditQuery = auditQuery.not('target_user_id', 'is', null);
  if (auditTarget === 'video') auditQuery = auditQuery.not('video_id', 'is', null);
  if (auditTarget === 'zone') auditQuery = auditQuery.not('h3_cell', 'is', null);
  if (auditTarget === 'system') {
    auditQuery = auditQuery.is('target_user_id', null).is('video_id', null).is('h3_cell', null);
  }
  auditQuery = auditQuery.range(auditOffset, auditOffset + pageSize - 1);

  const [stats, processingVideos, merchants, users, actions, mediaConfig, t, tk, tc, format] =
    await Promise.all([
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
        ? /^[0-9a-f-]{36}$/i.test(search)
          ? admin
              .from('profiles')
              .select(userColumns)
              .eq('id', search)
              .range(userOffset, userOffset + pageSize - 1)
          : admin
              .from('profiles')
              .select(userColumns, { count: 'exact' })
              .ilike('username', `%${search}%`)
              .order('username')
              .range(userOffset, userOffset + pageSize - 1)
        : admin
            .from('profiles')
            .select(userColumns, { count: 'exact' })
            .not('banned_at', 'is', null)
            .order('username')
            .range(userOffset, userOffset + pageSize - 1),
      auditQuery,
      admin
        .from('app_config')
        .select('key, value')
        .in('key', [...MEDIA_CONFIG_KEYS]),
      getTranslations('admin'),
      getTranslations('moderation.decisions.kinds'),
      getTranslations('common.categories'),
      getFormatter(),
    ]);

  const parsedStats = statsSchema.safeParse(stats.data);
  const config = new Map((mediaConfig.data ?? []).map((item) => [item.key, item.value]));
  const parsedMediaSettings = mediaSettingsSchema.safeParse({
    faceBlurEnabled: config.get('media_face_blur_enabled'),
    plateBlurEnabled: config.get('media_plate_blur_enabled'),
    detectEvery: config.get('media_detect_every'),
    faceMinScore: config.get('media_face_min_score'),
    plateMinScore: config.get('media_plate_min_score'),
  });
  if (
    stats.error ||
    processingVideos.error ||
    merchants.error ||
    users.error ||
    actions.error ||
    mediaConfig.error ||
    !parsedStats.success ||
    !parsedMediaSettings.success
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
          .select('video_id, status, attempts, max_attempts, progress, phase, updated_at')
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
  const initialMediaSettings: MediaSettings = parsedMediaSettings.data;
  const auditParams = new URLSearchParams({
    ...(search ? { q: search } : {}),
    ...(auditKind ? { action: auditKind } : {}),
    ...(auditActor ? { actor: auditActor } : {}),
    ...(auditTarget ? { target: auditTarget } : {}),
    ...(auditSince ? { since: auditSince } : {}),
  });
  const userPageHref = (nextPage: number) => {
    const params = new URLSearchParams({ ...(search ? { q: search } : {}) });
    params.set('page', String(nextPage));
    return `/admin?${params}#users`;
  };
  const auditPageHref = (nextPage: number) => {
    const params = new URLSearchParams(auditParams);
    params.set('auditPage', String(nextPage));
    return `/admin?${params}#actions`;
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 p-4 pb-8 sm:p-6">
      <header className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">Voisino</p>
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

      <nav
        aria-label={t('navigation')}
        className="sticky top-0 z-20 -mx-4 flex gap-2 overflow-x-auto border-b border-line bg-ink/95 px-4 py-2 backdrop-blur sm:static sm:mx-0 sm:flex-wrap sm:overflow-visible sm:border-0 sm:bg-transparent sm:p-0"
      >
        {(
          [
            'overview',
            'mediaSettings',
            'processingVideos',
            'zones',
            'merchants',
            'users',
            'actions',
          ] as const
        ).map((key) => (
          <a
            key={key}
            href={`#${key}`}
            className="min-h-10 shrink-0 rounded-full border border-line px-3 py-2 text-sm font-medium hover:border-accent focus-visible:outline-accent"
          >
            {t(key)}
          </a>
        ))}
      </nav>

      <MediaProcessingSettings
        initial={initialMediaSettings}
        availability={{
          faces: process.env.FACE_BLUR_ENABLED !== 'false',
          plates:
            process.env.PLATE_BLUR_ENABLED === 'true' &&
            Boolean(process.env.PLATE_MODEL_PATH?.trim()),
        }}
      />

      <section
        id="overview"
        aria-labelledby="overview-title"
        className="scroll-mt-20 flex flex-col gap-3"
      >
        <h2 id="overview-title" className="text-lg font-semibold">
          {t('overview')}
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {STAT_KEYS.map((key) => {
            const href = STAT_LINKS[key];
            const style = STAT_STYLE[key];
            return (
              <div
                key={key}
                className={`relative flex flex-col overflow-hidden rounded-3xl border border-white/[0.07] bg-panel/80 p-4 ${href ? 'transition hover:border-accent/50' : ''}`}
              >
                <dt className="text-sm leading-snug text-fog">
                  <span
                    aria-hidden="true"
                    className={`mb-3 flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg ${style.tile}`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    >
                      <path d={style.icon} />
                    </svg>
                  </span>
                  {t(`stats.${key}`)}
                </dt>
                <dd className="mt-1 text-3xl font-bold tabular-nums">
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

      <section
        id="processingVideos"
        aria-labelledby="processing-videos-title"
        className="scroll-mt-20 flex flex-col gap-3"
      >
        <div>
          <h2 id="processing-videos-title" className="text-lg font-semibold">
            {t('processingVideos')}
            <span className="ml-2 rounded-full bg-sky-500/15 px-2 py-0.5 text-sm text-sky-300">
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
          <>
            <ProcessingRefresh />
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
                      <p className="font-semibold text-sky-300">{t('videoStatusProcessing')}</p>
                      <p className="text-xs text-fog">
                        {job ? (
                          <>
                            {t(`jobStatus.${job.status}`)}
                            {' · '}
                            {t('jobAttempts', {
                              attempts: job.attempts,
                              maxAttempts: job.max_attempts,
                            })}
                            {' · '}
                            {t(`jobPhase.${job.phase}`)}
                          </>
                        ) : (
                          t('noProcessingJob')
                        )}
                      </p>
                      {job && (
                        <div className="mt-2 min-w-48">
                          <div className="mb-1 flex justify-between text-xs text-fog">
                            <span>{t('processingProgress')}</span>
                            <span>{job.progress}%</span>
                          </div>
                          <progress
                            aria-label={t('processingProgress')}
                            value={job.progress}
                            max={100}
                            className="h-2 w-full accent-[var(--color-accent)]"
                          />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section id="zones" aria-labelledby="zones" className="scroll-mt-20 flex flex-col gap-3">
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

      <section
        id="merchants"
        aria-labelledby="merchants-title"
        className="scroll-mt-20 flex flex-col gap-3"
      >
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

      <section
        id="users"
        aria-labelledby="users-title"
        className="scroll-mt-20 flex flex-col gap-3"
      >
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
            autoComplete="off"
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
        {(users.count ?? 0) > pageSize && (
          <nav aria-label={t('userPagination')} className="flex items-center justify-between gap-3">
            <span className="text-sm text-fog">
              {t('pageOf', {
                page: page + 1,
                pages: Math.ceil((users.count ?? 0) / pageSize),
              })}
            </span>
            <div className="flex gap-2">
              {page > 0 && (
                <Link
                  className="rounded-lg border border-line px-3 py-2 text-sm"
                  href={userPageHref(page - 1)}
                >
                  {t('previous')}
                </Link>
              )}
              {userOffset + users.data.length < (users.count ?? 0) && (
                <Link
                  className="rounded-lg border border-line px-3 py-2 text-sm"
                  href={userPageHref(page + 1)}
                >
                  {t('next')}
                </Link>
              )}
            </div>
          </nav>
        )}
      </section>

      <section
        id="actions"
        aria-labelledby="actions-title"
        className="scroll-mt-20 flex flex-col gap-3"
      >
        <div>
          <h2 id="actions-title" className="text-lg font-semibold">
            {t('actions')}
          </h2>
          <p className="text-sm text-fog">{t('actionsHint')}</p>
        </div>
        <form action="/admin" method="get" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('filterAction')}</span>
            <select name="action" defaultValue={auditKind ?? ''} className={inputClass}>
              <option value="">{t('allActions')}</option>
              {AUDIT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {tk(kind)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('filterActor')}</span>
            <input
              name="actor"
              defaultValue={auditActor}
              className={inputClass}
              placeholder={t('actorId')}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('filterTarget')}</span>
            <select name="target" defaultValue={auditTarget} className={inputClass}>
              <option value="">{t('allTargets')}</option>
              {(['user', 'video', 'zone', 'system'] as const).map((kind) => (
                <option key={kind} value={kind}>
                  {t(`targetTypes.${kind}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('since')}</span>
            <input type="date" name="since" defaultValue={auditSince} className={inputClass} />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="min-h-11 rounded-xl border border-line px-4 font-semibold hover:border-accent"
            >
              {t('applyFilters')}
            </button>
            <Link href="/admin#actions" className="min-h-11 content-center px-2 text-sm underline">
              {t('clearFilters')}
            </Link>
          </div>
        </form>
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
        {(actions.count ?? 0) > pageSize && (
          <nav
            aria-label={t('auditPagination')}
            className="flex items-center justify-between gap-3"
          >
            <span className="text-sm text-fog">
              {t('pageOf', {
                page: auditPage + 1,
                pages: Math.ceil((actions.count ?? 0) / pageSize),
              })}
            </span>
            <div className="flex gap-2">
              {auditPage > 0 && (
                <Link
                  className="rounded-lg border border-line px-3 py-2 text-sm"
                  href={auditPageHref(auditPage - 1)}
                >
                  {t('previous')}
                </Link>
              )}
              {auditOffset + actionRows.length < (actions.count ?? 0) && (
                <Link
                  className="rounded-lg border border-line px-3 py-2 text-sm"
                  href={auditPageHref(auditPage + 1)}
                >
                  {t('next')}
                </Link>
              )}
            </div>
          </nav>
        )}
      </section>
    </div>
  );
}
