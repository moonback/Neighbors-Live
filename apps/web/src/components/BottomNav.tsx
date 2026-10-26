'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const items = [
  { href: '/', key: 'feed', icon: 'M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z' },
  { href: '/carte', key: 'map', icon: 'M9 4l6 2 6-2v16l-6 2-6-2-6 2V6zM9 4v16M15 6v16' },
  { href: '/filmer', key: 'record', icon: '' },
  { href: '/me', key: 'profile', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-8 9a8 8 0 0116 0' },
  {
    href: '/parametres',
    key: 'settings',
    icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 00-2-1.2L14.5 3h-5l-.4 2.6a7 7 0 00-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 000 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 002 1.2l.4 2.6h5l.4-2.6a7 7 0 002-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
  },
] as const;

export function BottomNav({ isModerator = false }: { isModerator?: boolean }) {
  const t = useTranslations('common.nav');
  const pathname = usePathname();
  if (pathname === '/admin' || (isModerator && pathname.startsWith('/moderation'))) return null;
  return (
    <nav
      aria-label={t('label')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-lg items-center justify-around">
        {items.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          if (item.key === 'record') {
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-label={t(item.key)}
                  className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-ink shadow-lg ring-4 ring-ink"
                >
                  <span className="block h-5 w-5 rounded-full bg-alert" aria-hidden="true" />
                </Link>
              </li>
            );
          }
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 min-w-14 flex-col items-center justify-center gap-0.5 px-2 text-[11px] ${active ? 'text-accent' : 'text-fog'}`}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                >
                  <path d={item.icon} />
                </svg>
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
