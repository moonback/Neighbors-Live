import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { MerchantReview, NotedAction } from '@/components/admin/AdminClient';
import { Card, inputClass } from '@/components/ui';
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

const STAT_KEYS = [
  'users',
  'banned',
  'active_videos',
  'hidden_videos',
  'open_reports',
  'pending_appeals',
  'pending_merchants',
] as const;
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

  const [stats, merchants, users, actions, t, tk, format] = await Promise.all([
    admin.rpc('admin_stats', { p_admin: viewer.id }),
    admin
      .from('merchant_profiles')
      .select('user_id, business_name')
      .eq('status', 'pending')
      .limit(20),
    search
      ? admin.from('profiles').select(userColumns).ilike('username', `%${search}%`).limit(20)
      : admin.from('profiles').select(userColumns).not('banned_at', 'is', null).limit(20),
    admin
      .from('moderation_actions')
      .select('id, kind, note, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    getTranslations('admin'),
    getTranslations('moderation.decisions.kinds'),
    getFormatter(),
  ]);
  const s = (stats.data ?? {}) as Record<string, number | Zone[]>;
  const zones = (s.zones as Zone[] | undefined) ?? [];
  const now = new Date();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 p-4">
      <h1 className="pt-4 text-2xl font-bold">{t('title')}</h1>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STAT_KEYS.map((k) => (
          <Card key={k} className="p-3">
            <dt className="text-xs text-fog">{t(`stats.${k}`)}</dt>
            <dd className="text-2xl font-bold">{String(s[k] ?? 0)}</dd>
          </Card>
        ))}
      </dl>

      <section className="flex flex-col gap-2" aria-labelledby="zones">
        <h2 id="zones" className="text-lg font-semibold">
          {t('zones')}
        </h2>
        <ul className="flex flex-col gap-1 text-sm">
          {zones.slice(0, 15).map((z) => (
            <li
              key={z.h3_cell}
              className="flex justify-between gap-2 rounded-lg border border-line px-3 py-2"
            >
              <a href={`/moderation?cell=${z.h3_cell}`} className="font-mono underline">
                {z.h3_cell.slice(3, 9)}
              </a>
              <span className="text-fog">
                {t('zoneRow', {
                  active: z.active,
                  hidden: z.hidden,
                  reports: z.open_reports,
                  mods: z.moderators,
                })}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="merchants">
        <h2 id="merchants" className="text-lg font-semibold">
          {t('merchants')}
        </h2>
        {(merchants.data ?? []).map((m) => (
          <MerchantReview key={m.user_id} userId={m.user_id} name={m.business_name} />
        ))}
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="users">
        <h2 id="users" className="text-lg font-semibold">
          {t('users')}
        </h2>
        <form className="flex gap-2" role="search">
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
        </form>
        <ul className="flex flex-col gap-2">
          {(users.data ?? []).map((u) => (
            <li key={u.id} className="flex flex-col gap-1 rounded-xl border border-line p-3">
              <p className="text-sm">
                <strong>@{u.username}</strong> · {u.role} · {u.reputation}
                {u.banned_at && <span className="text-alert"> · {t('banned')}</span>}
              </p>
              {u.id !== viewer.id && (
                <NotedAction
                  label={u.banned_at ? t('unban') : t('ban')}
                  variant={u.banned_at ? 'secondary' : 'danger'}
                  body={{ type: 'ban', userId: u.id, banned: !u.banned_at }}
                />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="actions">
        <h2 id="actions" className="text-lg font-semibold">
          {t('actions')}
        </h2>
        <ul className="flex flex-col gap-2">
          {(actions.data ?? []).map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-1 rounded-xl border border-line p-3 text-sm"
            >
              <p>
                <strong>{tk(a.kind)}</strong> · {format.relativeTime(new Date(a.created_at), now)}
                {a.note && <span className="text-fog"> — {a.note}</span>}
              </p>
              {REVERTIBLE.has(a.kind) && (
                <NotedAction label={t('revert')} body={{ type: 'revert', actionId: a.id }} />
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
