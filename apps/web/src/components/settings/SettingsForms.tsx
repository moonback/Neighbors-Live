'use client';

import { RADII_M } from '@nl/shared';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, Card, Field, inputClass, Notice } from '@/components/ui';
import { useErrorText } from '@/components/useErrorText';
import { api } from '@/lib/client-api';

type Status = { kind: 'success' | 'error'; text: string } | null;

export function ProfileForm({ username, bio }: { username: string; bio: string }) {
  const t = useTranslations('settings.profile');
  const tw = useTranslations('auth.welcome');
  const ta = useTranslations('common.actions');
  const errorText = useErrorText();
  const router = useRouter();
  const [values, setValues] = useState({ username, bio });
  const [status, setStatus] = useState<Status>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await api('/api/me/profile', { method: 'PATCH', body: values });
    if (res.ok) {
      setStatus({ kind: 'success', text: t('saved') });
      router.refresh();
      return;
    }
    const text =
      res.error === 'conflict'
        ? tw('taken')
        : res.error === 'invalid_input'
          ? tw('invalid')
          : (errorText(res.error) ?? '');
    setStatus({ kind: 'error', text });
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t('title')}</h2>
        <Field label={t('username')} htmlFor="s-username">
          <input
            id="s-username"
            className={inputClass}
            value={values.username}
            maxLength={20}
            autoCapitalize="none"
            onChange={(e) => setValues({ ...values, username: e.target.value.toLowerCase() })}
          />
        </Field>
        <Field label={t('bio')} htmlFor="s-bio" hint={t('bioHint', { count: values.bio.length })}>
          <textarea
            id="s-bio"
            className={`${inputClass} min-h-20`}
            value={values.bio}
            maxLength={160}
            onChange={(e) => setValues({ ...values, bio: e.target.value })}
          />
        </Field>
        {status && <Notice kind={status.kind}>{status.text}</Notice>}
        <Button type="submit">{ta('save')}</Button>
      </form>
    </Card>
  );
}

export function PreferencesForm({
  defaultRadius,
  locale,
}: {
  defaultRadius: number;
  locale: string;
}) {
  const t = useTranslations('settings.preferences');
  const tr = useTranslations('common.radius');
  const errorText = useErrorText();
  const router = useRouter();
  const [status, setStatus] = useState<Status>(null);

  async function save(body: object) {
    const res = await api('/api/me/settings', { method: 'PATCH', body });
    setStatus(
      res.ok
        ? { kind: 'success', text: t('saved') }
        : { kind: 'error', text: errorText(res.error) ?? '' },
    );
    if (res.ok) router.refresh();
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{t('title')}</h2>
      <Field label={t('radius')} htmlFor="s-radius">
        <select
          id="s-radius"
          className={inputClass}
          defaultValue={defaultRadius}
          onChange={(e) => save({ defaultRadius: Number(e.target.value) })}
        >
          {RADII_M.map((r) => (
            <option key={r} value={r}>
              {tr(String(r))}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('language')} htmlFor="s-locale">
        <select
          id="s-locale"
          className={inputClass}
          defaultValue={locale}
          onChange={(e) => save({ locale: e.target.value })}
        >
          <option value="fr">{t('languages.fr')}</option>
          <option value="en">{t('languages.en')}</option>
        </select>
      </Field>
      {status && <Notice kind={status.kind}>{status.text}</Notice>}
    </Card>
  );
}

export function DataSection() {
  const t = useTranslations('settings.data');
  return (
    <Card className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{t('title')}</h2>
      <p className="text-sm text-fog">{t('exportHint')}</p>
      <a
        href="/api/me/export"
        download
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-4 font-semibold"
      >
        {t('export')}
      </a>
    </Card>
  );
}

export function DangerZone({ username }: { username: string }) {
  const t = useTranslations('settings.danger');
  const errorText = useErrorText();
  const router = useRouter();
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    const res = await api('/api/me', { method: 'DELETE', body: { confirm } });
    setPending(false);
    if (!res.ok) return setError(errorText(res.error));
    router.replace('/?deleted=1');
    router.refresh();
  }

  return (
    <Card className="flex flex-col gap-3 border-alert/60">
      <h2 className="text-lg font-semibold text-alert">{t('title')}</h2>
      <p className="text-sm text-fog">{t('body')}</p>
      <Field label={t('confirmLabel', { username })} htmlFor="s-confirm" error={error}>
        <input
          id="s-confirm"
          className={inputClass}
          value={confirm}
          autoCapitalize="none"
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>
      <Button
        variant="danger"
        disabled={pending || confirm.trim().toLowerCase() !== username}
        onClick={remove}
      >
        {t('submit')}
      </Button>
    </Card>
  );
}
