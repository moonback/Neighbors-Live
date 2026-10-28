import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Avatar } from '@/components/Avatar';
import { HiddenVideos } from '@/components/profile/HiddenVideos';
import { MyVideos } from '@/components/profile/MyVideos';
import { SavedVideos } from '@/components/profile/SavedVideos';
import { signMedia } from '@/lib/media';
import { getViewer } from '@/lib/session';
import { profileImageUrl } from '@/lib/profile-image';
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
    .select(
      'id, username, bio, avatar_color, avatar_path, cover_path, role, reputation, created_at',
    )
    .eq('username', decodeURIComponent(username).toLowerCase())
    .is('banned_at', null)
    .maybeSingle();
  if (!profile) notFound();

  const [viewer, zones, videos, merchant, t, tc, format] = await Promise.all([
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
    profile.role === 'merchant'
      ? admin
          .from('merchant_profiles')
          .select('business_name, description, website, phone, address')
          .eq('user_id', profile.id)
          .eq('status', 'approved')
          .maybeSingle()
      : Promise.resolve(null),
    getTranslations('profile'),
    getTranslations('common'),
    getFormatter(),
  ]);
  const isOwner = viewer?.id === profile.id;
  const list = videos.data ?? [];
  const merchantData = merchant && !merchant.error ? merchant.data : null;
  const posters = await signMedia(list.map((v) => v.poster_path));
  const isModerator = (zones.count ?? 0) > 0;
  const since = format.dateTime(new Date(profile.created_at), { month: 'long', year: 'numeric' });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 pb-8 sm:p-6">
      <header className="relative flex flex-col items-center gap-3 overflow-hidden rounded-3xl border border-white/[0.07] bg-panel/80 px-5 pt-32 pb-6 text-center">
        {profile.cover_path ? (
          // eslint-disable-next-line @next/next/no-img-element -- public profile image URL
          <img
            src={profileImageUrl(profile.cover_path) ?? undefined}
            alt=""
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-40 w-full object-cover"
          />
        ) : null}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/30 to-panel"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-28 bg-accent opacity-25 blur-2xl"
        />
        {isOwner && (
          <Link
            href="/parametres"
            aria-label={tc('nav.settings')}
            className="glass absolute top-3 right-3 flex h-11 w-11 items-center justify-center rounded-full text-white"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 12a7.4 7.4 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 00-2-1.2L14.5 3h-5l-.4 2.6a7 7 0 00-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 000 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 002 1.2l.4 2.6h5l.4-2.6a7 7 0 002-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" />
            </svg>
          </Link>
        )}
        <span className="glow relative rounded-full bg-accent p-1">
          <span className="block rounded-full bg-ink p-0.5">
            <Avatar
              username={profile.username}
              color={profile.avatar_color}
              size={88}
              src={profileImageUrl(profile.avatar_path)}
            />
          </span>
        </span>
        <h1 className="relative max-w-full truncate text-2xl font-bold">@{profile.username}</h1>
        <div className="relative flex flex-wrap justify-center gap-2 text-xs">
          {isModerator && (
            <span className="rounded-full bg-accent px-2.5 py-1 font-semibold text-ink">
              {tc('badges.moderator')}
            </span>
          )}
          {profile.role === 'merchant' && (
            <span className="rounded-full bg-amber-400 px-2.5 py-1 font-semibold text-ink">
              {tc('badges.merchant')}
            </span>
          )}
          {profile.role === 'admin' && (
            <span className="rounded-full bg-fog px-2.5 py-1 font-semibold text-ink">
              {tc('badges.admin')}
            </span>
          )}
        </div>
        <dl className="relative mt-2 grid w-full max-w-sm grid-cols-2 divide-x divide-white/10">
          <div className="flex flex-col-reverse">
            <dt className="text-xs text-fog">{t('activeVideos')}</dt>
            <dd className="text-xl font-bold tabular-nums">{list.length}</dd>
          </div>
          <div className="flex flex-col-reverse">
            <dt className="text-xs text-fog">{t('reputation')}</dt>
            <dd className="text-xl font-bold tabular-nums">{profile.reputation}</dd>
          </div>
        </dl>
        <p className="relative text-xs text-fog">{t('memberSince', { date: since })}</p>
        {profile.bio && (
          <p className="relative max-w-md whitespace-pre-line text-sm leading-relaxed text-white/85">
            {profile.bio}
          </p>
        )}
        {merchantData && (
          <div className="relative flex max-w-md flex-wrap justify-center gap-2 text-xs text-fog">
            {merchantData.website && (
              <a
                href={merchantData.website}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/10 px-2.5 py-1 text-white hover:border-accent/60"
              >
                {merchantData.business_name || 'Website'}
              </a>
            )}
            {merchantData.phone && (
              <a
                href={`tel:${merchantData.phone}`}
                className="rounded-full border border-white/10 px-2.5 py-1 text-white hover:border-accent/60"
              >
                {merchantData.phone}
              </a>
            )}
            {merchantData.address && (
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-white">
                {merchantData.address}
              </span>
            )}
          </div>
        )}
        {isOwner && (
          <nav className="relative mt-2 grid w-full max-w-sm grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Link
              href="/parametres"
              className="glow inline-flex min-h-11 items-center justify-center rounded-2xl bg-accent px-4 font-semibold text-white"
            >
              {t('edit')}
            </Link>
            <Link
              href="/me/sauvegardes"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 font-semibold hover:border-accent/60"
            >
              {t('savedVideos')}
            </Link>
            <Link
              href="/me/masquees"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 font-semibold hover:border-accent/60"
            >
              {t('hiddenVideos')}
            </Link>
            <Link
              href="/me/decisions"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 font-semibold hover:border-accent/60"
            >
              {t('decisions')}
            </Link>
          </nav>
        )}
      </header>

      <section aria-labelledby="active-videos" className="flex flex-col gap-3">
        <h2
          id="active-videos"
          className="w-fit border-b-2 border-accent pb-2 text-base font-semibold"
        >
          {t('activeVideos')}
        </h2>
        {list.length === 0 ? (
          <p className="text-fog">{t('noVideos')}</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:gap-3">
            {list.map((v) => {
              const poster = v.poster_path ? posters.get(v.poster_path) : undefined;
              return (
                <li key={v.id}>
                  <Link
                    href={`/v/${v.id}`}
                    className="relative block aspect-[9/16] overflow-hidden rounded-2xl bg-panel ring-1 ring-white/5 transition hover:ring-accent/60"
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

      {isOwner && (
        <>
          <SavedVideos />
          <HiddenVideos />
          <MyVideos />
        </>
      )}
    </div>
  );
}
