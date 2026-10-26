'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

const sections = [
  { href: '/admin', key: 'dashboard', icon: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z' },
  {
    href: '/moderation',
    key: 'moderation',
    icon: 'M12 3l9 4v5c0 5-3.8 8-9 9-5.2-1-9-4-9-9V7zM8 12l2.5 2.5L16 9',
  },
  {
    href: '/admin#merchants',
    key: 'merchants',
    icon: 'M3 10h18M5 10V6l7-3 7 3v4M5 10v10h14V10M9 20v-6h6v6',
  },
] as const;

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
  if (!enabled || (pathname !== '/admin' && !pathname.startsWith('/moderation'))) return children;

  return (
    <div className="admin-theme min-h-dvh">
      <div className="mx-auto flex min-h-dvh max-w-[1600px]">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-white px-4 py-6 lg:flex">
          <Link
            href={isAdmin ? '/admin' : '/moderation'}
            className="mb-9 flex items-center gap-3 px-3"
            aria-label="Neighbors Live"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-lg font-black text-white">
              N
            </span>
            <span className="leading-tight">
              <strong className="block text-sm">Neighbors</strong>
              <span className="text-xs text-fog">Live · {t('workspace')}</span>
            </span>
          </Link>
          <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-fog">
            {t('workspace')}
          </p>
          <nav aria-label={t('navigation')} className="flex flex-col gap-1">
            {sections
              .filter((item) => isAdmin || item.key === 'moderation')
              .map((item) => {
                const active =
                  item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className="admin-sidebar-link flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-fog transition-colors hover:bg-ink hover:text-accent"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinejoin="round"
                    >
                      <path d={item.icon} />
                    </svg>
                    {t(item.key)}
                  </Link>
                );
              })}
            {isAdmin && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-fog">
                  {t('tools')}
                </p>
                {(['zones', 'users', 'actions'] as const).map((key) => (
                  <Link
                    key={key}
                    href={`/admin#${key}`}
                    className="admin-sidebar-link flex min-h-10 items-center rounded-xl px-3 text-sm text-fog hover:bg-ink hover:text-accent"
                  >
                    {t(key)}
                  </Link>
                ))}
              </div>
            )}
          </nav>
          <div className="mt-auto rounded-2xl bg-ink p-4 text-sm">
            <p className="font-semibold">{t('workspace')}</p>
            <p className="mt-1 text-xs text-fog">{t('workspaceHint')}</p>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="hidden h-16 items-center justify-end border-b border-line bg-white px-8 lg:flex">
            <Link
              href="/me"
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm hover:bg-ink"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent font-semibold text-white">
                {(username?.[0] ?? 'A').toUpperCase()}
              </span>
              <span className="font-semibold">{username ? `@${username}` : t('profile')}</span>
            </Link>
          </header>
          <div className="border-b border-line bg-white px-4 py-3 lg:hidden">
            <nav aria-label={t('navigation')} className="flex gap-2 overflow-x-auto">
              {sections
                .filter((item) => isAdmin || item.key === 'moderation')
                .map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className="min-h-10 shrink-0 rounded-full border border-line px-4 py-2 text-sm font-semibold text-fog"
                  >
                    {t(item.key)}
                  </Link>
                ))}
              {isAdmin && (
                <Link
                  href="/admin#users"
                  className="min-h-10 shrink-0 rounded-full border border-line px-4 py-2 text-sm font-semibold text-fog"
                >
                  {t('users')}
                </Link>
              )}
            </nav>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
