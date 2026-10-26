'use client';

import { useTranslations } from 'next-intl';
import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const t = useTranslations('settings.preferences');
  const { theme, setTheme } = useTheme();
  const light = theme === 'light';

  return (
    <section className="rounded-3xl border border-white/[0.07] bg-panel/80 p-5 shadow-xl shadow-black/20">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">{t('theme')}</h2>
          <p className="mt-1 text-sm text-fog">{t('themeHint')}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={light}
          aria-label={t('theme')}
          onClick={() => setTheme(light ? 'dark' : 'light')}
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${light ? 'bg-accent' : 'bg-white/20'}`}
        >
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${light ? 'translate-x-7' : 'translate-x-1'}`}
          />
        </button>
      </div>
      <p className="mt-3 text-sm font-medium">{light ? t('light') : t('dark')}</p>
    </section>
  );
}
