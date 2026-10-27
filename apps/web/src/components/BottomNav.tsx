'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const items = [
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
  { href: '/filmer', key: 'record', icon: '' },
  { href: '/me', key: 'profile', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-8 9a8 8 0 0116 0' },
] as const;

function isActive(href: string, pathname: string) {
  if (href === '/') return pathname === '/';
  if (href === '/me') return ['/me', '/u/', '/parametres'].some((p) => pathname.startsWith(p));
  return pathname.startsWith(href);
}

export function BottomNav({ isModerator = false }: { isModerator?: boolean }) {
  const t = useTranslations('common.nav');
  const pathname = usePathname();
  if (pathname === '/admin' || (isModerator && pathname.startsWith('/moderation'))) return null;
  return (
    <nav
      aria-label={t('label')}
      className="bottom-nav fixed inset-x-0 bottom-0 z-40 rounded-t-3xl pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-lg items-center justify-around px-2">
        {items.map((item) => {
          if (item.key === 'record') {
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-label={t(item.key)}
                  className="record-button -mt-7 flex h-14 w-14 items-center justify-center rounded-full text-white ring-4 ring-black transition-transform active:scale-95"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-7 w-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </Link>
              </li>
            );
          }
          const active = isActive(item.href, pathname);
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-16 min-w-14 flex-col items-center justify-center gap-1 px-2 text-[11px] font-medium transition-colors ${active ? 'text-white' : 'text-fog hover:text-white'}`}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-6 w-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                >
                  <path d={item.icon} />
                </svg>
                {t(item.key)}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-1.5 h-1 w-5 rounded-full bg-accent"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
