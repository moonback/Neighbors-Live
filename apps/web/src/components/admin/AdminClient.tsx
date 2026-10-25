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
  const [pending, setPending] = useState(false);
  const run = async (body: Body) => {
    if (pending) return;
    setPending(true);
    const res = await api('/api/admin', { body });
    setStatus(
      res.ok
        ? { kind: 'success', text: t('done') }
        : {
            kind: 'error',
            text:
              res.error === 'review_conflict'
                ? t('review_conflict')
                : (errorText(res.error) ?? t('actionError')),
          },
    );
    if (res.ok) router.refresh();
    setPending(false);
  };
  return { run, status, pending };
}

export function MerchantReview({
  userId,
  name,
  applicant,
  description,
  submittedAt,
}: {
  userId: string;
  name: string;
  applicant: string;
  description: string;
  submittedAt: string;
}) {
  const t = useTranslations('admin');
  const { run, status, pending } = useAdminAction();
  const review = (approve: boolean) => {
    if (window.confirm(t(approve ? 'confirmApproveMerchant' : 'confirmRejectMerchant', { name }))) {
      void run({ type: 'merchant', userId, approve });
    }
  };
  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl border border-line bg-panel p-4">
      <div className="flex-1">
        <h3 className="font-semibold">{name}</h3>
        <p className="text-sm text-fog">{t('merchantApplicant', { username: applicant })}</p>
        <p className="mt-1 text-sm leading-relaxed text-fog">
          {description || t('noMerchantDescription')}
        </p>
        <p className="mt-2 text-xs text-fog">{t('submittedAt', { date: submittedAt })}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => review(true)}>
          {t('approve')}
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => review(false)}>
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
  const { run, status, pending } = useAdminAction();
  const [note, setNote] = useState('');
  const id = `note-${body.type}-${body.type === 'ban' ? body.userId : body.actionId}`;
  const submit = () => {
    if (body.type === 'ban' && body.banned && !window.confirm(t('confirmBan'))) return;
    if (body.type === 'revert' && !window.confirm(t('confirmRevert'))) return;
    void run({ ...body, note });
  };
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
        <Button variant={variant} disabled={pending || note.trim().length < 3} onClick={submit}>
          {pending ? t('saving') : label}
        </Button>
      </div>
      {status && <Notice kind={status.kind}>{status.text}</Notice>}
    </div>
  );
}
