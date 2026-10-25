'use client';

import { usernameSchema } from '@nl/shared';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, Field, inputClass } from '@/components/ui';
import { useErrorText } from '@/components/useErrorText';
import { api } from '@/lib/client-api';

export function UsernameForm({ next }: { next: string }) {
  const t = useTranslations('auth.welcome');
  const errorText = useErrorText();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = usernameSchema.safeParse(username);
    if (!parsed.success) return setError(t('invalid'));
    setPending(true);
    const res = await api('/api/me/profile', { method: 'PATCH', body: { username: parsed.data } });
    setPending(false);
    if (!res.ok) return setError(res.error === 'conflict' ? t('taken') : errorText(res.error));
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label={t('username')} htmlFor="username" error={error}>
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
          aria-invalid={Boolean(error)}
        />
      </Field>
      <Button type="submit" disabled={pending || username.length < 3}>
        {t('submit')}
      </Button>
    </form>
  );
}
