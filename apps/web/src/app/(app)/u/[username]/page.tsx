import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Avatar } from '@/components/Avatar';
import { MyVideos } from '@/components/profile/MyVideos';
import { signMedia } from '@/lib/media';
import { getViewer } from '@/lib/session';
import { adminClient } from '@/lib/supabase/admin';

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  return { title: (await getTranslations('profile'))('title', { username }) };
}

export default async function ProfilePage({ params }: Params) {
  const { username } = await params;
  const admin = adminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('id, username, bio, avatar_color, role, reputation, created_at')
    .eq('username', decodeURIComponent(username).toLowerCase())
    .is('banned_at', null)
    .maybeSingle();
  if (!profile) notFound();

  const [viewer, zones, videos, t, tc, format] = await Promise.all([
    getViewer(),
    admin
      .from('zone_moderators')
      .select('h3_cell', { count: 'exact', head: true })
      .eq('user_id', profile.id),
    admin
      .from('videos')
      .select('id, category, caption, poster_path')
      .eq('author_id', profile.id)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('published_at', { ascending: false })
      .limit(30),
    getTranslations('profile'),
    getTranslations('common'),
    getFormatter(),
  ]);
  const isOwner = viewer?.id === profile.id;
  const list = videos.data ?? [];
  const posters = await signMedia(list.map((v) => v.poster_path));
  const isModerator = (zones.count ?? 0) > 0;
  const since = format.dateTime(new Date(profile.created_at), { month: 'long', year: 'numeric' });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 pb-8 sm:p-6">
      <header className="flex flex-col gap-5 rounded-3xl border border-line bg-panel p-5 sm:flex-row sm:items-center sm:p-7">
        <Avatar username={profile.username} color={profile.avatar_color} size={72} />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
            Neighbors Live
          </p>
          <h1 className="truncate text-2xl font-bold sm:text-3xl">@{profile.username}</h1>
          <div className="flex flex-wrap gap-2 text-xs">
            {isModerator && (
              <span className="rounded-full bg-accent px-2 py-0.5 font-semibold text-ink">
                {tc('badges.moderator')}
              </span>
            )}
            {profile.role === 'merchant' && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 font-semibold text-ink">
                {tc('badges.merchant')}
              </span>
            )}
            {profile.role === 'admin' && (
              <span className="rounded-full bg-fog px-2 py-0.5 font-semibold text-ink">
                {tc('badges.admin')}
              </span>
            )}
          </div>
          <p className="text-sm text-fog">
            {t('reputation')} : <strong className="text-white">{profile.reputation}</strong> ·{' '}
            {t('memberSince', { date: since })}
          </p>
        </div>
      </header>
      {profile.bio && (
        <p className="whitespace-pre-line rounded-2xl border border-line bg-panel/70 p-4 leading-relaxed text-fog">
          {profile.bio}
        </p>
      )}
      {isOwner && (
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/parametres"
            className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 font-semibold hover:border-accent"
          >
            {t('edit')}
          </Link>
          <Link
            href="/me/decisions"
            className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 font-semibold hover:border-accent"
          >
            {t('decisions')}
          </Link>
        </nav>
      )}

      <section aria-labelledby="active-videos" className="flex flex-col gap-3">
        <h2 id="active-videos" className="text-lg font-semibold">
          {t('activeVideos')}
        </h2>
        {list.length === 0 ? (
          <p className="text-fog">{t('noVideos')}</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {list.map((v) => {
              const poster = v.poster_path ? posters.get(v.poster_path) : undefined;
              return (
                <li key={v.id}>
                  <Link
                    href={`/v/${v.id}`}
                    className="relative block aspect-[9/16] overflow-hidden rounded-xl bg-panel"
                  >
                    {poster && (
                      // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                      <img
                        src={poster}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    )}
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 p-1.5 text-[11px] leading-tight">
                      <span className="font-semibold">{tc(`categories.${v.category}`)}</span>
                      <span className="line-clamp-2 block text-fog">{v.caption}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {isOwner && <MyVideos />}
    </div>
  );
}
