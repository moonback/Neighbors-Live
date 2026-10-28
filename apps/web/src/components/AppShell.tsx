'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Avatar } from '@/components/Avatar';
import { BottomNav } from '@/components/BottomNav';
import { Logo } from '@/components/Logo';

interface ProfileAvatar {
  username: string | null;
  color: string;
  imageUrl: string | null;
}

const exploreLinks = [
  { href: '/', key: 'feed', icon: 'M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z' },
  {
    href: '/decouvrir',
    key: 'discover',
    icon: 'M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z',
  },
  {
    href: '/carte',
    key: 'map',
    icon: 'M12 21s-7-6.1-7-11.5A7 7 0 0112 2.5a7 7 0 017 7C19 14.9 12 21 12 21zm0-8.5a3 3 0 100-6 3 3 0 000 6z',
  },
  {
    href: '/commerces/decouvrir',
    key: 'shops',
    icon: 'M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0 2.7 2.7 0 005.3 0M10 20v-5h4v5',
  },
] as const;

const accountLinks = [
  { href: '/me', key: 'profile', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-8 9a8 8 0 0116 0' },
  {
    href: '/parametres',
    key: 'settings',
    icon: 'M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm0-6v2m0 15v2m9-9h-2m-14 0H3m15.36-6.36-1.42 1.42M7.06 16.94l-1.42 1.42m12.72 0-1.42-1.42M7.06 7.06 5.64 5.64',
  },
] as const;

function isActive(href: string, pathname: string) {
  if (href === '/') return pathname === '/';
  if (href === '/me') return pathname.startsWith('/me') || pathname.startsWith('/u/');
  if (href === '/commerces/decouvrir') return pathname.startsWith('/commerces');
  return pathname.startsWith(href);
}

function Icon({ path }: { path: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d={path} />
    </svg>
  );
}

export function AppShell({
  children,
  isModerator,
  profileAvatar,
}: {
  children: ReactNode;
  isModerator: boolean;
  profileAvatar: ProfileAvatar | null;
}) {
  const pathname = usePathname();
  const t = useTranslations('common');
  const workspace = pathname === '/admin' || pathname.startsWith('/moderation');
  const immersive = pathname === '/filmer';
  const feedOnlyDesktop = pathname === '/';
  const showNavigation = !workspace && !immersive && !feedOnlyDesktop;
  const showBottomNav = !workspace && !immersive && !feedOnlyDesktop;

  return (
    <div className="app-shell min-h-dvh lg:flex lg:gap-4 lg:px-4 lg:py-4">
      {showNavigation && (
        <aside className="app-sidebar sticky top-0 hidden h-dvh w-[17.5rem] shrink-0 flex-col px-3 py-4 lg:flex">
          <Link href="/" aria-label={t('appName')} className="mb-4 px-2 pt-1">
            <Logo name={t('appName')} tagline={t('slogan')} size={26} />
          </Link>
          <nav aria-label={t('nav.label')} className="flex flex-col gap-2.5">
            <section>
              <h2 className="mb-1 px-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-fog/60">
                {t('nav.exploreGroup')}
              </h2>
              <div className="flex flex-col gap-0.5">
                {exploreLinks.map((item) => {
                  const active = isActive(item.href, pathname);
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className="app-sidebar-link flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-[12px] font-semibold transition-colors"
                    >
                      <Icon path={item.icon} />
                      {t(`nav.${item.key}`)}
                    </Link>
                  );
                })}
              </div>
            </section>
            <Link
              href="/filmer"
              aria-current={immersive ? 'page' : undefined}
              className="app-record-link flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-[12px] font-bold text-white transition"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t('nav.record')}
            </Link>
            <section>
              <h2 className="mb-1 px-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-fog/60">
                {t('nav.accountGroup')}
              </h2>
              <div className="flex flex-col gap-0.5">
                {accountLinks.map((item) => {
                  const active = isActive(item.href, pathname);
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className="app-sidebar-link flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-[12px] font-semibold transition-colors"
                    >
                      {item.key === 'profile' && profileAvatar?.imageUrl ? (
                        <Avatar
                          username={profileAvatar.username}
                          color={profileAvatar.color}
                          size={20}
                          src={profileAvatar.imageUrl}
                        />
                      ) : (
                        <Icon path={item.icon} />
                      )}
                      {t(`nav.${item.key}`)}
                    </Link>
                  );
                })}
              </div>
            </section>
          </nav>
          <div className="app-sidebar-note mt-auto rounded-lg p-2.5">
            <Logo name={t('appName')} size={20} />
            <p className="mt-1.5 text-[11px] leading-relaxed text-fog">{t('tagline')}</p>
          </div>
        </aside>
      )}
      <main
        id="main"
        className={`app-main min-h-dvh min-w-0 flex-1 ${showNavigation ? 'pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:flex lg:items-start lg:justify-center lg:pb-0' : ''}`}
      >
        {children}
      </main>
      {showBottomNav && <BottomNav isModerator={isModerator} profileAvatar={profileAvatar} />}
    </div>
  );
}
