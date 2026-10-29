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

type Params = {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
};

const OWNER_TABS = ['videos', 'status', 'saved', 'hidden'] as const;
type Tab = (typeof OWNER_TABS)[number];

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  return { title: (await getTranslations('profile'))('title', { username }) };
}

export default async function ProfilePage({ params, searchParams }: Params) {
  const [{ username }, { tab: rawTab }] = await Promise.all([params, searchParams]);
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
          .select('business_name, description, website, phone, address, opening_hours')
          .eq('user_id', profile.id)
          .eq('status', 'approved')
          .maybeSingle()
      : Promise.resolve(null),
    getTranslations('profile'),
    getTranslations('common'),
    getFormatter(),
  ]);
  const isOwner = viewer?.id === profile.id;
  const tabs: readonly Tab[] = isOwner ? OWNER_TABS : ['videos'];
  const tab: Tab = tabs.find((x) => x === rawTab) ?? 'videos';
  const list = videos.data ?? [];
  const merchantData = merchant && !merchant.error ? merchant.data : null;
  const posters = await signMedia(list.map((v) => v.poster_path));
  const isModerator = (zones.count ?? 0) > 0;
  const since = format.dateTime(new Date(profile.created_at), { month: 'long', year: 'numeric' });
  const avatarSrc = profileImageUrl(profile.avatar_path);
  const base = `/u/${username}`;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 pb-8 sm:px-6 sm:py-8">
      <header className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:gap-8 sm:text-left">
        <span className="shrink-0">
          <span className="sm:hidden">
            <Avatar
              username={profile.username}
              color={profile.avatar_color}
              size={96}
              src={avatarSrc}
            />
          </span>
          <span className="hidden sm:inline">
            <Avatar
              username={profile.username}
              color={profile.avatar_color}
              size={180}
              src={avatarSrc}
            />
          </span>
        </span>

        <div className="flex min-w-0 flex-col items-center gap-3 sm:items-start sm:pt-2">
          <div className="flex min-w-0 flex-wrap items-baseline justify-center gap-x-3 gap-y-1 sm:justify-start">
            <h1 className="truncate text-xl font-bold sm:text-2xl">@{profile.username}</h1>
            <span className="text-sm text-fog">{t('memberSince', { date: since })}</span>
          </div>

          {(isModerator || profile.role === 'merchant' || profile.role === 'admin') && (
            <div className="flex flex-wrap justify-center gap-1.5 text-[11px] sm:justify-start">
              {isModerator && (
                <span className="rounded-full bg-accent px-2 py-0.5 font-semibold text-white">
                  {tc('badges.moderator')}
                </span>
              )}
              {profile.role === 'merchant' && (
                <span className="rounded-full bg-amber-400 px-2 py-0.5 font-semibold text-ink">
                  {tc('badges.merchant')}
                </span>
              )}
              {profile.role === 'admin' && (
                <span className="rounded-full bg-fog px-2 py-0.5 font-semibold text-ink">
                  {tc('badges.admin')}
                </span>
              )}
            </div>
          )}

          <dl className="flex gap-5 text-sm sm:text-base">
            <div className="flex items-baseline gap-1.5">
              <dd className="font-bold tabular-nums">{list.length}</dd>
              <dt className="text-fog">{t('activeVideos')}</dt>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dd className="font-bold tabular-nums">{profile.reputation}</dd>
              <dt className="text-fog">{t('reputation')}</dt>
            </div>
          </dl>

          {isOwner && (
            <nav aria-label={t('profileActions')} className="flex flex-wrap justify-center gap-2">
              <ProfileAction href="/parametres" primary>
                {t('edit')}
              </ProfileAction>
              <ProfileAction href="/me/decisions">{t('decisions')}</ProfileAction>
            </nav>
          )}

          {profile.bio && (
            <p className="max-w-xl whitespace-pre-line text-sm leading-snug text-white/85">
              {profile.bio}
            </p>
          )}
          {merchantData && (
            <div className="flex flex-wrap justify-center gap-1.5 text-xs text-fog sm:justify-start">
              {merchantData.website && (
                <a
                  href={merchantData.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-8 items-center rounded-full border border-white/10 px-2.5 text-white hover:border-accent/60"
                >
                  {merchantData.business_name || 'Website'}
                </a>
              )}
              {merchantData.phone && (
                <a
                  href={`tel:${merchantData.phone}`}
                  className="inline-flex min-h-8 items-center rounded-full border border-white/10 px-2.5 text-white hover:border-accent/60"
                >
                  {merchantData.phone}
                </a>
              )}
              {merchantData.address && (
                <span className="inline-flex min-h-8 items-center rounded-full border border-white/10 px-2.5 text-white">
                  {merchantData.address}
                </span>
              )}
              {merchantData.opening_hours && (
                <span className="inline-flex min-h-8 items-center rounded-full border border-white/10 px-2.5 text-white">
                  {merchantData.opening_hours}
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      <nav className="flex overflow-x-auto border-b border-white/10">
        {tabs.map((key) => (
          <Link
            key={key}
            href={key === 'videos' ? base : `${base}?tab=${key}`}
            aria-current={key === tab ? 'page' : undefined}
            scroll={false}
            className={`-mb-px flex min-h-11 flex-1 shrink-0 items-center justify-center whitespace-nowrap border-b-2 px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent sm:flex-none sm:px-8 sm:text-base ${
              key === tab
                ? 'border-white text-white'
                : 'border-transparent text-fog hover:text-white'
            }`}
          >
            {t(`tabs.${key}`)}
          </Link>
        ))}
      </nav>

      {tab === 'videos' &&
        (list.length === 0 ? (
          <p className="py-10 text-center text-fog">{t('noVideos')}</p>
        ) : (
          <ul
            aria-label={t('activeVideos')}
            className="-mx-4 grid grid-cols-3 gap-0.5 sm:mx-0 sm:grid-cols-4 sm:gap-3 lg:grid-cols-5 xl:grid-cols-6"
          >
            {list.map((v) => {
              const poster = v.poster_path ? posters.get(v.poster_path) : undefined;
              return (
                <li key={v.id}>
                  <Link
                    href={`/v/${v.id}`}
                    className="group relative block aspect-[3/4] overflow-hidden bg-panel sm:rounded-lg"
                  >
                    {poster && (
                      // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                      <img
                        src={poster}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    )}
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6 text-xs leading-tight">
                      <span className="flex items-center gap-1 font-semibold">
                        <svg
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          className="h-3.5 w-3.5 fill-current"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        {tc(`categories.${v.category}`)}
                      </span>
                      <span className="mt-0.5 hidden truncate text-white/80 sm:block">
                        {v.caption}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ))}
      {tab === 'status' && <MyVideos />}
      {tab === 'saved' && <SavedVideos />}
      {tab === 'hidden' && <HiddenVideos />}
    </div>
  );
}

function ProfileAction({
  href,
  primary = false,
  children,
}: {
  href: string;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-10 items-center justify-center rounded-lg px-5 text-center text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        primary
          ? 'bg-accent text-white hover:brightness-110'
          : 'bg-white/10 text-white hover:bg-white/15'
      }`}
    >
      {children}
    </Link>
  );
}
