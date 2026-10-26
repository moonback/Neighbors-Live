'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Logo } from '@/components/Logo';

const sections = [
  { href: '/admin', key: 'dashboard', icon: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z' },
  {
    href: '/moderation',
    key: 'moderation',
    icon: 'M12 3l9 4v5c0 5-3.8 8-9 9-5.2-1-9-4-9-9V7zM8 12l2.5 2.5L16 9',
  },
  {
    href: '/moderation#appeals',
    key: 'appeals',
    icon: 'M3 12a9 9 0 101.8-5.4M3 4v4h4M12 7v5l3 2',
  },
  {
    href: '/admin#merchants',
    key: 'merchants',
    icon: 'M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0 2.7 2.7 0 005.3 0M10 20v-5h4v5',
  },
] as const;

const tools = [
  {
    key: 'mediaSettings',
    icon: 'M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1M16 12a4 4 0 11-8 0 4 4 0 018 0z',
  },
  {
    key: 'zones',
    icon: 'M12 21s-7-6.1-7-11.5A7 7 0 0112 2.5a7 7 0 017 7C19 14.9 12 21 12 21zm0-8.5a3 3 0 100-6 3 3 0 000 6z',
  },
  {
    key: 'users',
    icon: 'M9 11a4 4 0 100-8 4 4 0 000 8zM2 21a7 7 0 0114 0M16 3.5a4 4 0 010 7.5M22 21a7 7 0 00-4-6.3',
  },
  { key: 'actions', icon: 'M12 8v4l3 2M12 21a9 9 0 100-18 9 9 0 000 18z' },
] as const;

function Icon({ d }: { d: string }) {
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
      <path d={d} />
    </svg>
  );
}

const linkClass =
  'admin-sidebar-link flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-fog transition hover:bg-white/5 hover:text-white';

export function AdminWorkspace({
  enabled,
  isAdmin,
  username,
  children,
}: {
  enabled: boolean;
  isAdmin: boolean;
  username: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  if (!enabled || (pathname !== '/admin' && !pathname.startsWith('/moderation'))) return children;
  const visible = sections.filter(
    (item) => isAdmin || item.key === 'moderation' || item.key === 'appeals',
  );

  return (
    <div className="admin-theme min-h-dvh">
      <div className="mx-auto flex min-h-dvh max-w-[1600px]">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-white/[0.06] bg-panel/60 px-4 py-6 backdrop-blur lg:flex">
          <Link
            href={isAdmin ? '/admin' : '/moderation'}
            className="mb-8 flex flex-col gap-1 px-2"
            aria-label={tc('appName')}
          >
            <Logo name={tc('appName')} size={30} />
            <span className="pl-10 text-xs font-semibold text-fog">{t('workspace')}</span>
          </Link>
          <nav aria-label={t('navigation')} className="flex flex-col gap-1">
            {visible.map((item) => {
              const active =
                item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={linkClass}
                >
                  <Icon d={item.icon} />
                  {t(item.key)}
                </Link>
              );
            })}
            {isAdmin && (
              <div className="mt-5 border-t border-white/[0.06] pt-4">
                <p className="mb-2 px-3 text-[11px] font-bold tracking-[0.14em] text-fog/70 uppercase">
                  {t('tools')}
                </p>
                {tools.map((item) => (
                  <Link key={item.key} href={`/admin#${item.key}`} className={linkClass}>
                    <Icon d={item.icon} />
                    {t(item.key)}
                  </Link>
                ))}
              </div>
            )}
          </nav>
          <Link
            href="/me"
            className="mt-auto flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 text-sm transition hover:border-accent/50"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent font-bold text-white">
              {(username?.[0] ?? 'A').toUpperCase()}
            </span>
            <span className="min-w-0 leading-tight">
              <strong className="block truncate">{username ? `@${username}` : t('profile')}</strong>
              <span className="text-xs text-fog">{t('profile')}</span>
            </span>
          </Link>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-white/[0.06] bg-ink/80 px-4 backdrop-blur-xl lg:px-8">
            <Link href={isAdmin ? '/admin' : '/moderation'} className="lg:hidden">
              <Logo name={tc('appName')} size={24} />
            </Link>
            {isAdmin && (
              <form
                action="/admin#users"
                role="search"
                className="relative hidden max-w-md flex-1 sm:block"
              >
                <label htmlFor="admin-search" className="sr-only">
                  {t('search')}
                </label>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-fog"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-4-4" />
                </svg>
                <input
                  id="admin-search"
                  name="q"
                  placeholder={t('search')}
                  autoComplete="off"
                  className="min-h-10 w-full rounded-xl border border-white/10 bg-white/5 pr-3 pl-10 text-sm placeholder:text-fog/70 focus:border-accent focus:outline-none"
                />
              </form>
            )}
            <Link
              href="/me"
              className="ml-auto flex min-h-11 items-center gap-3 rounded-xl px-2 text-sm hover:bg-white/5"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent font-semibold text-white">
                {(username?.[0] ?? 'A').toUpperCase()}
              </span>
              <span className="hidden font-semibold sm:inline">
                {username ? `@${username}` : t('profile')}
              </span>
            </Link>
          </header>
          <div className="border-b border-white/[0.06] px-4 py-3 lg:hidden">
            <nav aria-label={t('navigation')} className="flex gap-2 overflow-x-auto">
              {visible.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="glass flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white/90"
                >
                  <Icon d={item.icon} />
                  {t(item.key)}
                </Link>
              ))}
              {isAdmin && (
                <>
                  {tools.map((item) => (
                    <Link
                      key={item.key}
                      href={`/admin#${item.key}`}
                      className="glass flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white/90"
                    >
                      <Icon d={item.icon} />
                      {t(item.key)}
                    </Link>
                  ))}
                </>
              )}
            </nav>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
