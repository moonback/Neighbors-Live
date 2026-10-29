'use client';

import { REPORT_REASONS, type ReportReason } from '@nl/shared';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, Field, inputClass, Notice } from '@/components/ui';
import { useErrorText } from '@/components/useErrorText';
import { api } from '@/lib/client-api';
import { Sheet } from './Sheet';

export function ReportDialog({
  videoId,
  onClose,
}: {
  videoId: string | null;
  onClose: () => void;
}) {
  const t = useTranslations('video.reportPanel');
  const tc = useTranslations('common.actions');
  const errorText = useErrorText();
  const [reason, setReason] = useState<ReportReason>('recognizable_person');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  const close = () => {
    setStatus(null);
    setDetails('');
    onClose();
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!videoId) return;
    setPending(true);
    const res = await api(`/api/videos/${videoId}/report`, { body: { reason, details } });
    setPending(false);
    if (res.ok) setStatus({ kind: 'success', text: t('done') });
    else
      setStatus({
        kind: 'error',
        text: res.error === 'already_reported' ? t('already') : (errorText(res.error) ?? ''),
      });
  }

  return (
    <Sheet open={videoId !== null} title={t('title')} onClose={close} closeLabel={tc('close')}>
      {status?.kind === 'success' ? (
        <div className="flex flex-col gap-3">
          <Notice kind="success">{status.text}</Notice>
          <Link
            href="/me/decisions"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-white/[0.04] px-4 text-sm font-semibold"
          >
            {t('viewDecisions')}
          </Link>
          <Button onClick={close}>{tc('close')}</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-sm text-fog">{t('intro')}</p>
          <p className="text-xs text-fog">{t('threshold')}</p>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t('reason')}</legend>
            {REPORT_REASONS.map((r) => (
              <label
                key={r}
                className="flex min-h-11 items-center gap-3 rounded-xl border border-line px-3"
              >
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="h-5 w-5 accent-[var(--color-accent)]"
                />
                {t(`reasons.${r}`)}
              </label>
            ))}
          </fieldset>
          <Field label={t('details')} htmlFor="report-details">
            <textarea
              id="report-details"
              className={`${inputClass} min-h-20`}
              maxLength={500}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </Field>
          {status && <Notice kind="error">{status.text}</Notice>}
          <Button type="submit" variant="danger" disabled={pending}>
            {t('submit')}
          </Button>
        </form>
      )}
    </Sheet>
  );
}
