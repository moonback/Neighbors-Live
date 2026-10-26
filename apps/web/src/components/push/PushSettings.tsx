'use client';

import { RADII_M } from '@nl/shared';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { PermissionPrimer } from '@/components/PermissionPrimer';
import { Button, Card, Field, inputClass, Notice } from '@/components/ui';
import { useErrorText } from '@/components/useErrorText';
import { api } from '@/lib/client-api';
import { clientEnv } from '@/lib/env';
import {
  currentPosition,
  isIos,
  isStandalone,
  pushSupported,
  swRegistration,
  urlBase64ToUint8Array,
} from '@/lib/platform';

type State = 'loading' | 'unsupported' | 'ios-install' | 'off' | 'on';

async function detectState(): Promise<State> {
  if (isIos() && !isStandalone()) return 'ios-install';
  if (!pushSupported()) return 'unsupported';
  const reg = await swRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

export function PushSettings({
  notifyAlerts,
  defaultRadius,
}: {
  notifyAlerts: boolean;
  defaultRadius: number;
}) {
  const t = useTranslations('push');
  const ts = useTranslations('settings.notifications');
  const tr = useTranslations('common.radius');
  const errorText = useErrorText();
  const [state, setState] = useState<State>('loading');
  const [radius, setRadius] = useState(defaultRadius);
  const [alerts, setAlerts] = useState(notifyAlerts);
  const [primer, setPrimer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void detectState()
      .then((s) => alive && setState(s))
      .catch(() => alive && setState('unsupported'));
    return () => {
      alive = false;
    };
  }, []);

  async function enable() {
    setPrimer(false);
    setBusy(true);
    setError(null);
    try {
      if ((await Notification.requestPermission()) !== 'granted') return setError(t('denied'));
      let pos: GeolocationPosition;
      try {
        pos = await currentPosition();
      } catch {
        return setError(t('noPosition'));
      }
      const reg = await swRegistration();
      if (!reg) return setError(errorText('generic'));
      const subscription =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(clientEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
        }));
      const json = subscription.toJSON();
      const res = await api('/api/push/subscribe', {
        body: {
          subscription: { endpoint: json.endpoint, keys: json.keys },
          zone: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          radius,
        },
      });
      if (!res.ok) return setError(errorText(res.error));
      setState('on');
    } catch {
      setError(errorText('generic'));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const reg = await swRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const res = await api('/api/push/subscribe', {
          method: 'DELETE',
          body: { endpoint: sub.endpoint },
        });
        if (!res.ok) return setError(errorText(res.error));
        await sub.unsubscribe();
      }
      setState('off');
    } catch {
      setError(errorText('generic'));
    } finally {
      setBusy(false);
    }
  }

  async function toggleAlerts(value: boolean) {
    setError(null);
    setAlerts(value);
    try {
      const res = await api('/api/me/settings', { method: 'PATCH', body: { notifyAlerts: value } });
      if (!res.ok) {
        setAlerts(!value);
        setError(errorText(res.error));
      }
    } catch {
      setAlerts(!value);
      setError(errorText('generic'));
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{ts('title')}</h2>
      <label className="flex min-h-11 items-center justify-between gap-3">
        <span>
          {ts('alerts')}
          <span className="block text-xs text-fog">{ts('alertsHint')}</span>
        </span>
        <input
          type="checkbox"
          className="h-6 w-6 accent-[var(--color-accent)]"
          checked={alerts}
          onChange={(e) => toggleAlerts(e.target.checked)}
        />
      </label>

      <h3 className="font-medium">{t('title')}</h3>
      {state === 'unsupported' && <Notice>{t('unsupported')}</Notice>}
      {state === 'ios-install' && (
        <Notice>
          {t('iosInstall')}{' '}
          <Link href="/onboarding?step=install" className="underline">
            {t('iosInstallLink')}
          </Link>
        </Notice>
      )}
      {(state === 'off' || state === 'on') && (
        <>
          <Field label={t('radius')} htmlFor="push-radius">
            <select
              id="push-radius"
              className={inputClass}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              disabled={state === 'on'}
            >
              {RADII_M.map((r) => (
                <option key={r} value={r}>
                  {tr(String(r))}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-sm text-fog" aria-live="polite">
            {state === 'on' ? t('enabled', { radius: tr(String(radius)) }) : t('disabled')}
          </p>
          {state === 'off' ? (
            <Button onClick={() => setPrimer(true)} disabled={busy}>
              {t('enable')}
            </Button>
          ) : (
            <Button variant="secondary" onClick={disable} disabled={busy}>
              {t('disable')}
            </Button>
          )}
        </>
      )}
      {error && <Notice kind="error">{error}</Notice>}

      <PermissionPrimer
        open={primer}
        title={t('primer.title')}
        confirmLabel={t('primer.continue')}
        cancelLabel={t('primer.later')}
        onConfirm={enable}
        onCancel={() => setPrimer(false)}
      >
        <p>{t('primer.body')}</p>
        <ul className="list-disc pl-5">
          <li>{t('primer.notifications')}</li>
          <li>{t('primer.location')}</li>
        </ul>
      </PermissionPrimer>
    </Card>
  );
}
