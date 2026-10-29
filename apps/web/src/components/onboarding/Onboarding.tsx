'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button, Notice } from '@/components/ui';
import { api } from '@/lib/client-api';
import { isIos, isStandalone } from '@/lib/platform';

import { ONBOARDED_COOKIE } from '@/lib/onboarding';

const ONBOARDING_STEP_KEY = 'neighbors-onboarding-step';

/** Step resume is a convenience: blocked browser storage must not break or block onboarding. */
function readSavedStep(): number {
  try {
    return Number(window.localStorage.getItem(ONBOARDING_STEP_KEY));
  } catch {
    return Number.NaN;
  }
}

function saveStep(step: number | null) {
  try {
    if (step === null) window.localStorage.removeItem(ONBOARDING_STEP_KEY);
    else window.localStorage.setItem(ONBOARDING_STEP_KEY, String(step));
  } catch {
    // Without storage the current step simply is not resumed after a reload.
  }
}

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
}

const STEPS = ['value', 'permissions', 'rules'] as const;
const INSTALL_STEP = STEPS.length;

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
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other' | 'installed'>('other');

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    const timer = setTimeout(() => {
      setPlatform(
        isStandalone()
          ? 'installed'
          : isIos()
            ? 'ios'
            : /Android/i.test(navigator.userAgent)
              ? 'android'
              : 'other',
      );
      const saved = readSavedStep();
      const requestedInstallGuide =
        new URLSearchParams(window.location.search).get('step') === 'install';
      if (
        !requestedInstallGuide &&
        Number.isInteger(saved) &&
        saved >= 0 &&
        saved <= INSTALL_STEP
      ) {
        setStep(saved);
      }
    }, 0);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      clearTimeout(timer);
    };
  }, []);

  async function finish() {
    saveStep(null);
    // Non-sensitive preference cookie read by src/proxy.ts (no tracking, no personal data).
    document.cookie = `${ONBOARDED_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
    if (signedIn) await api('/api/me/settings', { method: 'PATCH', body: { onboarded: true } });
    router.replace(next);
  }

  const key = step === INSTALL_STEP ? 'install' : (STEPS[step] ?? 'value');
  const list = (k: string) => t.raw(k) as string[];
  const changeStep = (nextStep: number) => {
    const bounded = Math.max(0, Math.min(INSTALL_STEP, nextStep));
    saveStep(bounded);
    setStep(bounded);
  };

  return (
    <main
      id="main"
      className="mx-auto flex h-dvh w-full max-w-xl flex-col gap-4 overflow-hidden px-5 py-4 sm:gap-6 sm:p-6"
    >
      <div className="flex shrink-0 items-center justify-between pt-1 text-sm text-fog">
        {step !== INSTALL_STEP ? (
          <p aria-live="polite">
            {t('step', {
              current: step + 1,
              total: STEPS.length,
            })}
          </p>
        ) : (
          <span aria-hidden="true" />
        )}
        <Button variant="ghost" onClick={finish}>
          {t('skip')}
        </Button>
      </div>
      {step !== INSTALL_STEP && (
        <div className="flex shrink-0 gap-1.5" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-line'}`}
            />
          ))}
        </div>
      )}

      <section
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        aria-labelledby="onboarding-title"
      >
        <div className="flex flex-col gap-4 pb-4">
          {key === 'value' && (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              {t('value.eyebrow')}
            </p>
          )}
          <h1 id="onboarding-title" className="text-2xl font-bold leading-tight sm:text-3xl">
            {t(`${key}.title`)}
          </h1>
          {key === 'value' && (
            <>
              <p className="text-base leading-relaxed text-fog">{t('value.body')}</p>
              <ul className="flex flex-col gap-2">
                {list('value.points').map((p) => (
                  <li
                    key={p}
                    className="flex items-start gap-3 rounded-xl border border-line bg-panel px-3 py-2.5 text-sm leading-relaxed"
                  >
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
                      aria-hidden="true"
                    />
                    <span>{p}</span>
                  </li>
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
              {platform === 'android' && <Notice>{t('install.android')}</Notice>}
              {platform === 'other' && <Notice>{t('install.manual')}</Notice>}
              {platform !== 'installed' && prompt && (
                <Button
                  onClick={async () => {
                    await prompt.prompt();
                    setPrompt(null);
                  }}
                >
                  {t('install.button')}
                </Button>
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
        </div>
      </section>

      <div className="flex shrink-0 gap-3 border-t border-line bg-ink pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {step > 0 && step < INSTALL_STEP && (
          <Button variant="secondary" className="flex-1" onClick={() => changeStep(step - 1)}>
            {t('back')}
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button className="flex-1" onClick={() => changeStep(step + 1)}>
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
