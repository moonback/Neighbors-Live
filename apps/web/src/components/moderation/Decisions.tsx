'use client';

import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, Card, Field, inputClass, Notice } from '@/components/ui';
import { useErrorText } from '@/components/useErrorText';
import { api } from '@/lib/client-api';

/** Same window as the appeals RLS policy (30 days). */
const APPEAL_WINDOW_MS = 30 * 24 * 3_600_000;

export interface Decision {
  id: number;
  kind: string;
  note: string;
  createdAt: string;
  appealStatus: string | null;
  appealable: boolean;
}

export function Decisions({ items }: { items: Decision[] }) {
  const t = useTranslations('moderation.decisions');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const errorText = useErrorText();
  const [open, setOpen] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [appealed, setAppealed] = useState<Set<number>>(new Set());

  async function appeal(actionId: number) {
    const res = await api('/api/appeals', { body: { actionId, reason } });
    if (!res.ok) return setStatus({ kind: 'error', text: errorText(res.error) ?? '' });
    setStatus({ kind: 'success', text: t('appealSent') });
    setAppealed(new Set(appealed).add(actionId));
    setOpen(null);
    setReason('');
  }

  if (items.length === 0) return <p className="text-fog">{t('empty')}</p>;
  return (
    <div className="flex flex-col gap-3">
      {status && <Notice kind={status.kind}>{status.text}</Notice>}
      <ul className="flex flex-col gap-3">
        {items.map((d) => (
          <li key={d.id}>
            <Card className="flex flex-col gap-2">
              <p className="font-semibold">{t(`kinds.${d.kind}`)}</p>
              {d.note && <p className="text-sm text-fog">{d.note}</p>}
              <p className="text-xs text-fog">{format.relativeTime(new Date(d.createdAt), now)}</p>
              {d.appealStatus && (
                <p className="text-sm">
                  {t('appealed', { status: t(`status.${d.appealStatus}`) })}
                </p>
              )}
              {d.appealable &&
                now.getTime() - new Date(d.createdAt).getTime() < APPEAL_WINDOW_MS &&
                !d.appealStatus &&
                !appealed.has(d.id) &&
                (open === d.id ? (
                  <div className="flex flex-col gap-2">
                    <Field label={t('appealLabel')} htmlFor={`appeal-${d.id}`}>
                      <textarea
                        id={`appeal-${d.id}`}
                        className={`${inputClass} min-h-20`}
                        maxLength={1000}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </Field>
                    <Button disabled={reason.trim().length < 10} onClick={() => appeal(d.id)}>
                      {t('appeal')}
                    </Button>
                  </div>
                ) : (
                  <Button variant="secondary" onClick={() => setOpen(d.id)}>
                    {t('appeal')}
                  </Button>
                ))}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
