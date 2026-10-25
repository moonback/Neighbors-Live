'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button, Notice } from '@/components/ui';
import { api } from '@/lib/client-api';
import { isIos, isStandalone } from '@/lib/platform';

import { ONBOARDED_COOKIE } from '@/lib/onboarding';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
}

const STEPS = ['value', 'permissions', 'install', 'rules'] as const;

export function Onboarding({
  next,
  signedIn,
  initialStep,
}: {
  next: string;
  signedIn: boolean;
  initialStep: number;
}) {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [platform, setPlatform] = useState<'ios' | 'other' | 'installed'>('other');

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    const timer = setTimeout(
      () => setPlatform(isStandalone() ? 'installed' : isIos() ? 'ios' : 'other'),
      0,
    );
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      clearTimeout(timer);
    };
  }, []);

  async function finish() {
    // Non-sensitive preference cookie read by src/proxy.ts (no tracking, no personal data).
    document.cookie = `${ONBOARDED_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
    if (signedIn) await api('/api/me/settings', { method: 'PATCH', body: { onboarded: true } });
    router.replace(next);
  }

  const key = STEPS[step] ?? 'value';
  const list = (k: string) => t.raw(k) as string[];

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <div className="flex items-center justify-between pt-2 text-sm text-fog">
        <p aria-live="polite">{t('step', { current: step + 1, total: STEPS.length })}</p>
        <Button variant="ghost" onClick={finish}>
          {t('skip')}
        </Button>
      </div>
      <div className="flex gap-1.5" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-line'}`}
          />
        ))}
      </div>

      <section className="flex flex-1 flex-col gap-4" aria-labelledby="onboarding-title">
        <h1 id="onboarding-title" className="text-3xl font-bold">
          {t(`${key}.title`)}
        </h1>
        {key === 'value' && (
          <>
            <p className="text-fog">{t('value.body')}</p>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              {list('value.points').map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </>
        )}
        {key === 'permissions' && (
          <>
            <p className="text-fog">{t('permissions.body')}</p>
            <ul className="flex flex-col gap-3">
              {(['camera', 'location', 'notifications'] as const).map((p) => (
                <li key={p} className="rounded-xl border border-line bg-panel p-3">
                  {t(`permissions.${p}`)}
                </li>
              ))}
            </ul>
          </>
        )}
        {key === 'install' && (
          <>
            <p className="text-fog">{t('install.body')}</p>
            {platform === 'installed' && <Notice kind="success">{t('install.installed')}</Notice>}
            {platform === 'ios' && <Notice>{t('install.ios')}</Notice>}
            {platform === 'other' && (
              <>
                <Notice>{t('install.android')}</Notice>
                {prompt && (
                  <Button
                    onClick={async () => {
                      await prompt.prompt();
                      setPrompt(null);
                    }}
                  >
                    {t('install.button')}
                  </Button>
                )}
                <p className="text-sm text-fog">{t('install.ios')}</p>
              </>
            )}
          </>
        )}
        {key === 'rules' && (
          <>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              {list('rules.points').map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <Link href="/legal/regles" className="underline">
              {t('rules.link')}
            </Link>
          </>
        )}
      </section>

      <div className="flex gap-3 pb-[env(safe-area-inset-bottom)]">
        {step > 0 && (
          <Button variant="secondary" className="flex-1" onClick={() => setStep(step - 1)}>
            {t('back')}
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button className="flex-1" onClick={() => setStep(step + 1)}>
            {t('next')}
          </Button>
        ) : (
          <Button className="flex-1" onClick={finish}>
            {t('finish')}
          </Button>
        )}
      </div>
    </main>
  );
}
