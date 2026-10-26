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
  | { type: 'merchant'; userId: string; approve: boolean }
  | { type: 'mediaSettings'; settings: MediaSettings };

type AvailabilityReason =
  'ready' | 'disabled' | 'not_configured' | 'worker_offline' | 'model_unavailable';

export interface MediaSettings {
  faceBlurEnabled: boolean;
  plateBlurEnabled: boolean;
  detectEvery: number;
  faceMinScore: number;
  plateMinScore: number;
}

export interface MediaSettingsAuditEntry {
  id: number;
  actor_id: string | null;
  previous_settings: Record<string, unknown>;
  new_settings: Record<string, unknown>;
  created_at: string;
}

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
                : res.error === 'media_model_unavailable'
                  ? t('mediaProcessing.modelUnavailable')
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

export function MediaProcessingSettings({
  initial,
  availability,
  audit,
}: {
  initial: MediaSettings;
  availability: {
    faces: { available: boolean; reason: AvailabilityReason };
    plates: { available: boolean; reason: AvailabilityReason };
  };
  audit: MediaSettingsAuditEntry[];
}) {
  const t = useTranslations('admin.mediaProcessing');
  const { run, status, pending } = useAdminAction();
  const [settings, setSettings] = useState({
    ...initial,
    detectEvery: String(initial.detectEvery),
    faceMinScore: String(initial.faceMinScore),
    plateMinScore: String(initial.plateMinScore),
  });
  const parsed = {
    detectEvery: Number(settings.detectEvery),
    faceMinScore: Number(settings.faceMinScore),
    plateMinScore: Number(settings.plateMinScore),
  };
  const valid =
    Number.isInteger(parsed.detectEvery) &&
    parsed.detectEvery >= 1 &&
    parsed.detectEvery <= 10 &&
    Number.isFinite(parsed.faceMinScore) &&
    parsed.faceMinScore >= 0.05 &&
    parsed.faceMinScore <= 0.95 &&
    Number.isFinite(parsed.plateMinScore) &&
    parsed.plateMinScore >= 0.05 &&
    parsed.plateMinScore <= 0.95;

  return (
    <section id="mediaSettings" aria-labelledby="media-settings-title" className="scroll-mt-20">
      <div className="flex flex-col gap-4 rounded-3xl border border-line bg-panel/80 p-5">
        <div>
          <h2 id="media-settings-title" className="text-lg font-semibold">
            {t('title')}
          </h2>
          <p className="mt-1 text-sm text-fog">{t('hint')}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex min-h-12 items-center gap-3 rounded-xl border border-line px-3">
            <input
              type="checkbox"
              checked={settings.faceBlurEnabled}
              disabled={!availability.faces.available && !settings.faceBlurEnabled}
              onChange={(event) =>
                setSettings((current) => ({ ...current, faceBlurEnabled: event.target.checked }))
              }
              className="h-5 w-5 accent-[var(--color-accent)]"
            />
            <span className="text-sm font-medium">{t('faces')}</span>
          </label>
          {!availability.faces.available && (
            <p className="text-xs text-fog">{t(`availability.${availability.faces.reason}`)}</p>
          )}
          <label className="flex min-h-12 items-center gap-3 rounded-xl border border-line px-3">
            <input
              type="checkbox"
              checked={settings.plateBlurEnabled}
              disabled={!availability.plates.available && !settings.plateBlurEnabled}
              onChange={(event) =>
                setSettings((current) => ({ ...current, plateBlurEnabled: event.target.checked }))
              }
              className="h-5 w-5 accent-[var(--color-accent)]"
            />
            <span className="text-sm font-medium">{t('plates')}</span>
          </label>
          {!availability.plates.available && (
            <p className="text-xs text-fog">{t(`availability.${availability.plates.reason}`)}</p>
          )}
        </div>
        <p className="text-xs text-fog">{t('detectEveryHelp')}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('detectEvery')}</span>
            <input
              type="number"
              min={1}
              max={10}
              step={1}
              value={settings.detectEvery}
              onChange={(event) =>
                setSettings((current) => ({ ...current, detectEvery: event.target.value }))
              }
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('faceMinScore')}</span>
            <input
              type="number"
              min={0.05}
              max={0.95}
              step={0.05}
              value={settings.faceMinScore}
              onChange={(event) =>
                setSettings((current) => ({ ...current, faceMinScore: event.target.value }))
              }
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('plateMinScore')}</span>
            <input
              type="number"
              min={0.05}
              max={0.95}
              step={0.05}
              value={settings.plateMinScore}
              onChange={(event) =>
                setSettings((current) => ({ ...current, plateMinScore: event.target.value }))
              }
              className={inputClass}
            />
          </label>
        </div>
        <p className="text-xs text-fog">{t('thresholdHelp')}</p>
        <p className="text-xs text-fog">{t('modelNote')}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            disabled={pending || !valid}
            onClick={() =>
              void run({
                type: 'mediaSettings',
                settings: {
                  faceBlurEnabled: settings.faceBlurEnabled,
                  plateBlurEnabled: settings.plateBlurEnabled,
                  ...parsed,
                },
              })
            }
          >
            {pending ? t('saving') : t('save')}
          </Button>
          {status && <Notice kind={status.kind}>{status.text}</Notice>}
        </div>
        {audit.length > 0 && (
          <details className="rounded-xl border border-line px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold">{t('auditTitle')}</summary>
            <ul className="mt-3 flex flex-col gap-2 text-xs text-fog">
              {audit.map((entry) => (
                <li key={entry.id}>
                  {new Date(entry.created_at).toLocaleString()} ·{' '}
                  {t('auditActor', { actor: entry.actor_id?.slice(0, 8) ?? '—' })}
                  {' · '}
                  {t('auditChange', {
                    detectEvery: String(entry.new_settings.detect_every ?? '—'),
                    faces: String(entry.new_settings.face_blur_enabled ?? '—'),
                    plates: String(entry.new_settings.plate_blur_enabled ?? '—'),
                    faceThreshold: String(entry.new_settings.face_min_score ?? '—'),
                    plateThreshold: String(entry.new_settings.plate_min_score ?? '—'),
                  })}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
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
