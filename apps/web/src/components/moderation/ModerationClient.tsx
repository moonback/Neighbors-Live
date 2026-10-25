'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, Card, Field, inputClass, Notice } from '@/components/ui';
import { useErrorText } from '@/components/useErrorText';
import { api } from '@/lib/client-api';

export interface QueueItem {
  videoId: string;
  category: string;
  caption: string;
  status: string;
  hiddenReason: string | null;
  reportCount: number;
  reasons: string[];
  author: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
}

export interface AppealItem {
  appealId: string;
  reason: string;
  actionKind: string;
  actionNote: string;
  caption: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
}

type Status = { kind: 'success' | 'error'; text: string } | null;

export function ModerationQueue({ items }: { items: QueueItem[] }) {
  const t = useTranslations('moderation');
  const tc = useTranslations('common.categories');
  const tr = useTranslations('video.reportPanel.reasons');
  if (items.length === 0) return <p className="text-fog">{t('empty')}</p>;
  return (
    <ul className="flex flex-col gap-4">
      {items.map((item) => (
        <li key={item.videoId} data-testid="queue-item" data-video-id={item.videoId}>
          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <strong>{tc(item.category)}</strong>
              <span className="text-fog">@{item.author}</span>
              <span className="rounded-full bg-line px-2 py-0.5 text-xs">
                {t('reports', { count: item.reportCount })}
              </span>
              {item.status === 'hidden' && (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-ink">
                  {t('hiddenAuto')}
                </span>
              )}
            </div>
            {item.videoUrl && (
              <video
                src={item.videoUrl}
                poster={item.posterUrl ?? undefined}
                controls
                playsInline
                preload="metadata"
                className="max-h-96 w-full rounded-xl bg-black object-contain"
              />
            )}
            {item.caption && <p>{item.caption}</p>}
            {item.reasons.length > 0 && (
              <p className="text-sm text-fog">
                {t('reasons')} : {item.reasons.map((r) => tr(r)).join(', ')}
              </p>
            )}
            <DecisionForm videoId={item.videoId} />
          </Card>
        </li>
      ))}
    </ul>
  );
}

function DecisionForm({ videoId }: { videoId: string }) {
  const t = useTranslations('moderation');
  const errorText = useErrorText();
  const router = useRouter();
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<Status>(null);
  const [pending, setPending] = useState(false);

  async function decide(action: 'validate' | 'hide' | 'remove' | 'warn') {
    setPending(true);
    const res = await api('/api/moderation', {
      body: { type: 'decision', videoId, action, note },
    });
    setPending(false);
    if (!res.ok) {
      const noteMissing = res.error === 'invalid_input' || res.error === 'note_required';
      return setStatus({
        kind: 'error',
        text: noteMissing ? t('note') : (errorText(res.error) ?? ''),
      });
    }
    setStatus({ kind: 'success', text: t('done') });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <Field label={t('note')} htmlFor={`note-${videoId}`}>
        <textarea
          id={`note-${videoId}`}
          className={`${inputClass} min-h-16`}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Button disabled={pending} onClick={() => decide('validate')}>
          {t('actions.validate')}
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => decide('hide')}>
          {t('actions.hide')}
        </Button>
        <Button
          variant="danger"
          disabled={pending || note.trim().length < 3}
          onClick={() => decide('remove')}
        >
          {t('actions.remove')}
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => decide('warn')}>
          {t('actions.warn')}
        </Button>
      </div>
      {status && <Notice kind={status.kind}>{status.text}</Notice>}
    </div>
  );
}

export function AppealsQueue({ items }: { items: AppealItem[] }) {
  const t = useTranslations('moderation');
  const tk = useTranslations('moderation.decisions.kinds');
  const errorText = useErrorText();
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>(null);

  async function resolve(appealId: string, uphold: boolean) {
    const res = await api('/api/moderation', {
      body: { type: 'appeal', appealId, uphold, note: notes[appealId] ?? '' },
    });
    setStatus(
      res.ok
        ? { kind: 'success', text: t('done') }
        : { kind: 'error', text: errorText(res.error) ?? '' },
    );
    if (res.ok) router.refresh();
  }

  if (items.length === 0) return <p className="text-fog">{t('appealsEmpty')}</p>;
  return (
    <div className="flex flex-col gap-4">
      {status && <Notice kind={status.kind}>{status.text}</Notice>}
      <ul className="flex flex-col gap-4">
        {items.map((a) => (
          <li key={a.appealId}>
            <Card className="flex flex-col gap-2">
              <p className="text-sm font-semibold">
                {tk(a.actionKind)}
                {a.actionNote && <span className="font-normal text-fog"> — {a.actionNote}</span>}
              </p>
              {a.videoUrl && (
                <video
                  src={a.videoUrl}
                  poster={a.posterUrl ?? undefined}
                  controls
                  playsInline
                  preload="metadata"
                  className="max-h-80 w-full rounded-xl bg-black object-contain"
                />
              )}
              {a.caption && <p className="text-sm">{a.caption}</p>}
              <p className="text-sm">
                <span className="text-fog">{t('appealReason')} : </span>
                {a.reason}
              </p>
              <label className="sr-only" htmlFor={`an-${a.appealId}`}>
                {t('note')}
              </label>
              <textarea
                id={`an-${a.appealId}`}
                className={`${inputClass} min-h-14`}
                value={notes[a.appealId] ?? ''}
                onChange={(e) => setNotes({ ...notes, [a.appealId]: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => resolve(a.appealId, true)}>{t('uphold')}</Button>
                <Button variant="secondary" onClick={() => resolve(a.appealId, false)}>
                  {t('reject')}
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ApplyForm({ eligible, cells }: { eligible: boolean; cells: string[] }) {
  const t = useTranslations('moderation.apply');
  const errorText = useErrorText();
  const router = useRouter();
  const [cell, setCell] = useState(cells[0] ?? '');
  const [status, setStatus] = useState<Status>(null);

  async function apply() {
    const res = await api('/api/moderation', { body: { type: 'apply', cell } });
    setStatus(
      res.ok
        ? { kind: 'success', text: t('done') }
        : { kind: 'error', text: errorText(res.error) ?? '' },
    );
    if (res.ok) router.refresh();
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{t('title')}</h2>
      <p className="text-sm text-fog">{t('rules')}</p>
      <Notice kind={eligible ? 'success' : 'info'}>
        {eligible ? t('eligible') : t('notEligible')}
      </Notice>
      {eligible &&
        (cells.length === 0 ? (
          <p className="text-sm text-fog">{t('noZone')}</p>
        ) : (
          <>
            <Field label={t('zone')} htmlFor="apply-cell">
              <select
                id="apply-cell"
                className={inputClass}
                value={cell}
                onChange={(e) => setCell(e.target.value)}
              >
                {cells.map((c) => (
                  <option key={c} value={c}>
                    {c.slice(3, 9)}
                  </option>
                ))}
              </select>
            </Field>
            <Button onClick={apply}>{t('submit')}</Button>
          </>
        ))}
      {status && <Notice kind={status.kind}>{status.text}</Notice>}
    </Card>
  );
}
