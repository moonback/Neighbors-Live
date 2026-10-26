'use client';

import { passwordSchema, usernameSchema } from '@nl/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, Field, inputClass, Notice } from '@/components/ui';
import { useErrorText } from '@/components/useErrorText';
import { api } from '@/lib/client-api';

/** Auth-specific error codes first, then the generic ones. */
function useAuthError() {
  const t = useTranslations('auth.errors');
  const generic = useErrorText();
  return (code: string | null | undefined) => (code && t.has(code) ? t(code) : generic(code));
}

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'current-password' | 'new-password';
}) {
  const t = useTranslations('auth');
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        required
        maxLength={72}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} pr-24`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-controls={id}
        className="absolute inset-y-0 right-2 my-auto h-9 rounded-lg px-2 text-sm text-fog"
      >
        {visible ? t('hidePassword') : t('showPassword')}
      </button>
    </div>
  );
}

function Consent() {
  const t = useTranslations('auth.login');
  return (
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
  );
}

/** Sign-in and sign-up on one screen (switchable), e-mail + password. */
export function AuthForm({
  mode: initialMode,
  next,
  callbackError,
}: {
  mode: 'login' | 'signup';
  next: string;
  callbackError: boolean;
}) {
  const t = useTranslations('auth');
  const authError = useAuthError();
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(
    callbackError ? t('login.callbackError') : null,
  );
  const [confirmSent, setConfirmSent] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === 'signup') {
      if (!usernameSchema.safeParse(username).success)
        return setError(t('errors.username_invalid'));
      const pwd = passwordSchema.safeParse(password);
      if (!pwd.success) return setError(authError(pwd.error.issues[0]?.message));
    }
    setPending(true);
    const res =
      mode === 'signup'
        ? await api<{ needsConfirmation?: boolean }>('/api/auth/signup', {
            body: { email, password, username },
          })
        : await api<{ needsUsername?: boolean }>('/api/auth/login', { body: { email, password } });
    setPending(false);
    if (!res.ok) {
      return setError(
        res.error === 'invalid_input' ? t('login.invalidEmail') : authError(res.error),
      );
    }
    const data = res.data as { needsConfirmation?: boolean; needsUsername?: boolean };
    if (mode === 'signup' && data.needsConfirmation) return setConfirmSent(email);
    const target =
      mode === 'signup'
        ? `/onboarding?next=${encodeURIComponent(next)}`
        : data.needsUsername
          ? `/bienvenue?next=${encodeURIComponent(next)}`
          : next;
    router.replace(target);
    router.refresh();
  }

  if (confirmSent) {
    return <Notice kind="success">{t('signup.checkEmail', { email: confirmSent })}</Notice>;
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label={t('login.email')} htmlFor="email">
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
        />
      </Field>
      {mode === 'signup' && (
        <Field label={t('signup.username')} htmlFor="username" hint={t('signup.usernameHint')}>
          <input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={20}
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            className={inputClass}
          />
        </Field>
      )}
      <Field
        label={mode === 'signup' ? t('signup.password') : t('login.password')}
        htmlFor="password"
        hint={mode === 'signup' ? t('signup.passwordHint') : undefined}
      >
        <PasswordInput
          id="password"
          value={password}
          onChange={setPassword}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        />
      </Field>
      {error && <Notice kind="error">{error}</Notice>}
      <Button type="submit" disabled={pending || !email || !password}>
        {mode === 'signup' ? t('signup.submit') : t('login.submit')}
      </Button>
      {mode === 'login' && (
        <Link href="/mot-de-passe-oublie" className="text-center text-sm underline">
          {t('login.forgot')}
        </Link>
      )}
      <p className="text-center text-sm text-fog">
        {mode === 'login' ? t('login.noAccount') : t('signup.hasAccount')}{' '}
        <button
          type="button"
          className="font-semibold text-white underline"
          onClick={() => {
            setError(null);
            setMode(mode === 'login' ? 'signup' : 'login');
          }}
        >
          {mode === 'login' ? t('login.toSignup') : t('signup.toLogin')}
        </button>
      </p>
      <Consent />
    </form>
  );
}

export function ForgotForm() {
  const t = useTranslations('auth');
  const authError = useAuthError();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await api('/api/auth/reset', { body: { email } });
    if (!res.ok) {
      return setError(
        res.error === 'invalid_input' ? t('login.invalidEmail') : authError(res.error),
      );
    }
    setSent(email);
  }

  if (sent) return <Notice kind="success">{t('forgot.sent', { email: sent })}</Notice>;
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label={t('login.email')} htmlFor="email" error={error}>
        <input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Button type="submit" disabled={!email}>
        {t('forgot.submit')}
      </Button>
    </form>
  );
}

export function NewPasswordForm() {
  const t = useTranslations('auth');
  const authError = useAuthError();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const pwd = passwordSchema.safeParse(password);
    if (!pwd.success) return setError(authError(pwd.error.issues[0]?.message));
    if (password !== confirm) return setError(t('reset.mismatch'));
    const res = await api('/api/auth/password', { body: { password } });
    if (!res.ok) return setError(res.status === 401 ? t('reset.expired') : authError(res.error));
    setDone(true);
  }

  if (done) return <Notice kind="success">{t('reset.done')}</Notice>;
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label={t('reset.password')} htmlFor="new-password" hint={t('signup.passwordHint')}>
        <PasswordInput
          id="new-password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
      </Field>
      <Field label={t('reset.confirm')} htmlFor="confirm-password">
        <PasswordInput
          id="confirm-password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
        />
      </Field>
      {error && <Notice kind="error">{error}</Notice>}
      <Button type="submit" disabled={!password || !confirm}>
        {t('reset.submit')}
      </Button>
    </form>
  );
}
