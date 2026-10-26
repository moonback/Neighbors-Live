'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { LogoMark } from '@/components/Logo';
import { Button, Notice } from '@/components/ui';
import type { LocationState } from '@/lib/useLocation';

const FEATURES = [
  { tile: 'from-violet-500 to-indigo-600', icon: 'M3 7h12v10H3zM15 10l6-3v10l-6-3' },
  {
    tile: 'from-sky-400 to-blue-600',
    icon: 'M12 21s-7-6.1-7-11.5A7 7 0 0112 2.5a7 7 0 017 7C19 14.9 12 21 12 21zm0-8.5a3 3 0 100-6 3 3 0 000 6z',
  },
  { tile: 'from-fuchsia-500 to-pink-600', icon: 'M4 9l1.5-5h13L20 9M4 9v11h16V9M10 20v-5h4v5' },
  { tile: 'from-amber-400 to-orange-500', icon: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4' },
] as const;

/**
 * Home screen shown until the viewer's position is known. It also serves as the explanation
 * shown before the system location prompt.
 */
export function WelcomeHero({
  status,
  signedIn,
  notice,
  onLocate,
  onLater,
}: {
  status: LocationState['status'];
  signedIn: boolean;
  notice: string | null;
  onLocate: () => void;
  onLater: () => void;
}) {
  const t = useTranslations('feed');
  const tc = useTranslations('common');
  const features = t.raw('hero.features') as { title: string; body: string }[];
  const locating = status === 'locating' || status === 'unknown';

  return (
    <section aria-labelledby="welcome-title" className="h-full overflow-y-auto overscroll-contain">
      <div className="relative h-[38%] max-h-[24rem] min-h-60 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- static decorative SVG */}
        <img
          src="/illustrations/city-night.svg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 pb-3 text-center">
          <span className="drop-shadow-[0_8px_24px_rgba(139,92,255,0.6)]">
            <LogoMark size={52} />
          </span>
          <p className="text-4xl font-extrabold tracking-tight">{tc('appName')}</p>
          <p className="text-sm font-medium text-fog">
            {tc('slogan').split(' ').slice(0, -1).join(' ')}{' '}
            <span className="font-semibold text-blue">{tc('slogan').split(' ').at(-1)}</span>
          </p>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-col gap-5 px-5 pt-3 pb-8">
        {notice && <Notice kind="success">{notice}</Notice>}
        <div className="flex flex-col gap-2 text-center">
          <h1 id="welcome-title" className="text-2xl leading-tight font-bold text-balance">
            {t('hero.title')}
          </h1>
          <p className="text-sm leading-relaxed text-fog">{t('hero.body')}</p>
        </div>

        <ul className="order-last grid grid-cols-2 gap-3">
          {features.map((f, i) => (
            <li
              key={f.title}
              className="flex flex-col gap-2 rounded-3xl border border-white/[0.07] bg-panel/80 p-3.5"
            >
              <span
                aria-hidden="true"
                className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${FEATURES[i]?.tile ?? FEATURES[0].tile}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                >
                  <path d={FEATURES[i]?.icon ?? FEATURES[0].icon} />
                </svg>
              </span>
              <span className="text-sm leading-tight font-semibold">{f.title}</span>
              <span className="text-xs leading-snug text-fog">{f.body}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-3">
          {status === 'denied' && <Notice kind="error">{t('location.denied')}</Notice>}
          {status === 'error' && <Notice>{t('location.needed')}</Notice>}
          <Button onClick={onLocate} disabled={locating} className="min-h-13 text-base">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className={`h-5 w-5 ${locating ? 'motion-safe:animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              {locating ? (
                <path d="M12 3a9 9 0 109 9" />
              ) : (
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3M12 17a5 5 0 100-10 5 5 0 000 10z" />
              )}
            </svg>
            <span role={locating ? 'status' : undefined}>
              {locating ? t('location.locating') : t('location.allow')}
            </span>
          </Button>
          <div className="flex gap-3 *:flex-1">
            <Link
              href="/commerces/decouvrir"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-sm font-semibold hover:border-accent/60"
            >
              {t('hero.shops')}
            </Link>
            {signedIn ? (
              status === 'primer' && (
                <Button variant="ghost" onClick={onLater}>
                  {t('location.later')}
                </Button>
              )
            ) : (
              <Link
                href="/login?next=/"
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-sm font-semibold hover:border-accent/60"
              >
                {t('hero.login')}
              </Link>
            )}
          </div>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-fog">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="mt-0.5 h-4 w-4 shrink-0 text-accent"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            >
              <path d="M6 11V8a6 6 0 0112 0v3M5 11h14v10H5z" />
            </svg>
            {t('location.primerBody')}
          </p>
        </div>
      </div>
    </section>
  );
}
