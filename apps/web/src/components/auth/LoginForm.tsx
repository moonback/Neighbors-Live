'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, Field, inputClass, Notice } from '@/components/ui';
import { useErrorText } from '@/components/useErrorText';
import { api } from '@/lib/client-api';

export function LoginForm({ next, callbackError }: { next: string; callbackError: boolean }) {
  const t = useTranslations('auth.login');
  const errorText = useErrorText();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(callbackError ? t('callbackError') : null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await api('/api/auth/magic-link', { body: { email, next } });
    setPending(false);
    if (res.ok) setSentTo(email);
    else setError(res.error === 'invalid_input' ? t('invalidEmail') : errorText(res.error));
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4">
        <Notice kind="success">{t('sent', { email: sentTo })}</Notice>
        <Button variant="ghost" onClick={() => setSentTo(null)}>
          {t('resend')}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label={t('email')} htmlFor="email" error={error}>
        <input
          id="email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          aria-invalid={Boolean(error)}
        />
      </Field>
      <Button type="submit" disabled={pending || !email}>
        {t('submit')}
      </Button>
      <p className="text-xs text-fog">
        {t.rich('consent', {
          terms: (c) => (
            <Link className="underline" href="/legal/conditions">
              {c}
            </Link>
          ),
          privacy: (c) => (
            <Link className="underline" href="/legal/confidentialite">
              {c}
            </Link>
          ),
        })}
      </p>
    </form>
  );
}
