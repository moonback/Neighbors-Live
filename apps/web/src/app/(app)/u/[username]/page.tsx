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
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-3 pb-8 sm:p-5">
      <header className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-panel/80">
        {profile.cover_path ? (
          // eslint-disable-next-line @next/next/no-img-element -- public profile image URL
          <img
            src={profileImageUrl(profile.cover_path) ?? undefined}
            alt=""
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-16 w-full object-cover sm:h-20"
          />
        ) : null}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/30 to-panel sm:h-20"
        />
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-12 bg-accent/20 blur-2xl" />
        <div className="relative flex flex-col gap-3 px-3 pb-3 pt-9 sm:gap-4 sm:px-5 sm:pb-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <span className="glow shrink-0 rounded-full bg-accent p-0.5">
              <span className="block rounded-full bg-ink p-0.5">
                <Avatar
                  username={profile.username}
                  color={profile.avatar_color}
                  size={64}
                  src={profileImageUrl(profile.avatar_path)}
                />
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold sm:text-2xl">@{profile.username}</h1>
              <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
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
              <p className="mt-1 truncate text-xs text-fog">{t('memberSince', { date: since })}</p>
            </div>
            <dl className="hidden shrink-0 divide-x divide-white/10 rounded-xl border border-white/[0.07] bg-black/10 sm:flex">
              <div className="px-3 py-2 text-center">
                <dd className="text-lg font-bold tabular-nums">{list.length}</dd>
                <dt className="text-[11px] text-fog">{t('activeVideos')}</dt>
              </div>
              <div className="px-3 py-2 text-center">
                <dd className="text-lg font-bold tabular-nums">{profile.reputation}</dd>
                <dt className="text-[11px] text-fog">{t('reputation')}</dt>
              </div>
            </dl>
          </div>

          <dl className="grid grid-cols-2 divide-x divide-white/10 rounded-xl border border-white/[0.07] bg-black/10 sm:hidden">
            <div className="flex items-center justify-center gap-2 px-2 py-1.5">
              <dd className="text-sm font-bold tabular-nums">{list.length}</dd>
              <dt className="text-xs text-fog">{t('activeVideos')}</dt>
            </div>
            <div className="flex items-center justify-center gap-2 px-2 py-1.5">
              <dd className="text-sm font-bold tabular-nums">{profile.reputation}</dd>
              <dt className="text-xs text-fog">{t('reputation')}</dt>
            </div>
          </dl>

          {profile.bio && (
            <p className="line-clamp-2 whitespace-pre-line text-sm leading-snug text-white/85 sm:max-w-2xl">
              {profile.bio}
            </p>
          )}
          {merchantData && (
            <div className="flex flex-wrap gap-1.5 text-xs text-fog">
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
            </div>
          )}
          {isOwner && (
            <nav
              aria-label={t('profileActions')}
              className="grid grid-cols-2 gap-1.5 text-xs sm:flex sm:flex-wrap"
            >
              <ProfileAction href="/parametres" primary>
                {t('edit')}
              </ProfileAction>
              <ProfileAction href="/me/sauvegardes">{t('savedVideos')}</ProfileAction>
              <ProfileAction href="/me/masquees">{t('hiddenVideos')}</ProfileAction>
              <ProfileAction href="/me/decisions">{t('decisions')}</ProfileAction>
            </nav>
          )}
        </div>
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
      className={`inline-flex min-h-10 items-center justify-center rounded-xl px-3 text-center font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:min-h-9 ${
        primary
          ? 'bg-accent text-white hover:brightness-110'
          : 'border border-white/10 bg-white/[0.04] text-white/90 hover:border-accent/60 hover:text-white'
      }`}
    >
      {children}
    </Link>
  );
}
