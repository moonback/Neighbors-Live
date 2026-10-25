'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, inputClass, Notice } from '@/components/ui';
import { useErrorText } from '@/components/useErrorText';
import { api } from '@/lib/client-api';

type Body =
  | { type: 'ban'; userId: string; banned: boolean; note: string }
  | { type: 'revert'; actionId: number; note: string }
  | { type: 'merchant'; userId: string; approve: boolean };

function useAdminAction() {
  const t = useTranslations('admin');
  const errorText = useErrorText();
  const router = useRouter();
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const run = async (body: Body) => {
    const res = await api('/api/admin', { body });
    setStatus(
      res.ok
        ? { kind: 'success', text: t('done') }
        : { kind: 'error', text: errorText(res.error) ?? '' },
    );
    if (res.ok) router.refresh();
  };
  return { run, status };
}

export function MerchantReview({ userId, name }: { userId: string; name: string }) {
  const t = useTranslations('admin');
  const { run, status } = useAdminAction();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="flex-1 font-medium">{name}</span>
        <Button onClick={() => run({ type: 'merchant', userId, approve: true })}>
          {t('approve')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => run({ type: 'merchant', userId, approve: false })}
        >
          {t('rejectMerchant')}
        </Button>
      </div>
      {status && <Notice kind={status.kind}>{status.text}</Notice>}
    </div>
  );
}

type NotedBody =
  { type: 'ban'; userId: string; banned: boolean } | { type: 'revert'; actionId: number };

/** Ban / unban or revert, both requiring a written reason. */
export function NotedAction({
  label,
  body,
  variant = 'secondary',
}: {
  label: string;
  body: NotedBody;
  variant?: 'secondary' | 'danger';
}) {
  const t = useTranslations('admin');
  const { run, status } = useAdminAction();
  const [note, setNote] = useState('');
  const id = `note-${body.type}-${body.type === 'ban' ? body.userId : body.actionId}`;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <label htmlFor={id} className="sr-only">
          {t('note')}
        </label>
        <input
          id={id}
          className={inputClass}
          placeholder={t('note')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button
          variant={variant}
          disabled={note.trim().length < 3}
          onClick={() => run({ ...body, note })}
        >
          {label}
        </Button>
      </div>
      {status && <Notice kind={status.kind}>{status.text}</Notice>}
    </div>
  );
}
