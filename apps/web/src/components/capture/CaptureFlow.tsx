'use client';

import {
  CAPTION_MAX,
  CATEGORIES,
  MAX_ACCURACY_M,
  MERCHANT_DURATIONS_H,
  type Category,
} from '@nl/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { PermissionPrimer } from '@/components/PermissionPrimer';
import { Button, Field, inputClass, Notice } from '@/components/ui';
import { useErrorText } from '@/components/useErrorText';
import { enqueue } from '@/lib/offline-queue';
import { currentPosition } from '@/lib/platform';
import { publish, PublishError, type Fix, type PublishMeta } from '@/lib/publish';
import { containerOf } from '@/lib/recorder';
import { Camera, type Recording } from './Camera';

type Step = 'primer' | 'camera' | 'preview' | 'form' | 'sending' | 'done' | 'queued';

/** datetime-local bounds for an event end: from now + 15 min to now + 7 days (local time). */
function eventBounds() {
  const local = (ms: number) => {
    const d = new Date(ms);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  };
  const now = Date.now();
  return { minEvent: local(now + 15 * 60_000), maxEvent: local(now + 7 * 24 * 3_600_000 - 60_000) };
}

export function CaptureFlow({ isMerchant }: { isMerchant: boolean }) {
  const t = useTranslations('capture');
  const tc = useTranslations('common.categories');
  const errorText = useErrorText();
  const router = useRouter();
  const [step, setStep] = useState<Step>('primer');
  const [rec, setRec] = useState<Recording | null>(null);
  const [category, setCategory] = useState<Category>('alert');
  const [caption, setCaption] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [merchantHours, setMerchantHours] = useState<number>(24);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [locating, setLocating] = useState(false);

  const previewUrl = useMemo(() => (rec ? URL.createObjectURL(rec.blob) : null), [rec]);
  useEffect(() => () => void (previewUrl && URL.revokeObjectURL(previewUrl)), [previewUrl]);

  const categories = CATEGORIES.filter((c) => c !== 'shop' || isMerchant);

  async function locate(): Promise<Fix | null> {
    setLocating(true);
    try {
      const pos = await currentPosition();
      const fix = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: Math.round(pos.coords.accuracy),
      };
      if (fix.accuracy > MAX_ACCURACY_M) {
        setError(t('location.imprecise', { accuracy: fix.accuracy }));
        return null;
      }
      return fix;
    } catch (e) {
      setError(
        (e as GeolocationPositionError).code === 1
          ? t('location.denied')
          : t('location.unavailable'),
      );
      return null;
    } finally {
      setLocating(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rec) return;
    setError(null);
    const fix = await locate();
    if (!fix) return;
    const meta: PublishMeta = {
      category,
      caption,
      mimeType: containerOf(rec.mime),
      durationMs: rec.durationMs,
      ...(category === 'event' && eventEnd && { eventEndsAt: new Date(eventEnd).toISOString() }),
      ...(category === 'shop' && { merchantHours }),
    };
    const keepForLater = async () => {
      await enqueue({ id: crypto.randomUUID(), blob: rec.blob, meta, fix, createdAt: Date.now() });
      setStep('queued');
    };
    if (!navigator.onLine) return keepForLater();
    setStep('sending');
    try {
      await publish(rec.blob, meta, fix, setProgress);
      setStep('done');
    } catch (err) {
      if (err instanceof PublishError && err.retryable) return keepForLater();
      setStep('form');
      const code = err instanceof PublishError ? err.code : 'generic';
      setError(t.has(`errorsPublish.${code}`) ? t(`errorsPublish.${code}`) : errorText(code));
    }
  }

  const [{ minEvent, maxEvent }] = useState(eventBounds);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink">
      <header className="absolute inset-x-0 top-0 z-10 flex justify-end p-3">
        <Link
          href="/"
          aria-label={t('close')}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-2xl"
        >
          ×
        </Link>
      </header>

      <PermissionPrimer
        open={step === 'primer'}
        title={t('primer.title')}
        confirmLabel={t('primer.continue')}
        cancelLabel={t('primer.later')}
        onConfirm={() => setStep('camera')}
        onCancel={() => router.push('/')}
      >
        <p>{t('primer.body')}</p>
        <ul className="list-disc pl-5">
          <li>{t('primer.camera')}</li>
          <li>{t('primer.location')}</li>
        </ul>
        <p>{t('primer.privacy')}</p>
      </PermissionPrimer>

      {step === 'camera' && (
        <Camera
          onRecorded={(r) => {
            setRec(r);
            setStep('preview');
          }}
        />
      )}

      {step === 'preview' && previewUrl && (
        <div className="flex h-full flex-col">
          <h1 className="sr-only">{t('preview.title')}</h1>
          <video
            src={previewUrl}
            controls
            autoPlay
            loop
            playsInline
            className="min-h-0 flex-1 bg-black object-contain"
          />
          <div className="flex gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setRec(null);
                setStep('camera');
              }}
            >
              {t('preview.retake')}
            </Button>
            <Button className="flex-1" onClick={() => setStep('form')}>
              {t('preview.next')}
            </Button>
          </div>
        </div>
      )}

      {(step === 'form' || step === 'sending') && (
        <form
          onSubmit={submit}
          className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 overflow-y-auto p-4 pt-16"
        >
          <h1 className="text-2xl font-bold">{t('form.title')}</h1>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t('form.category')}</legend>
            <div className="grid grid-cols-3 gap-2">
              {categories.map((c) => (
                <label
                  key={c}
                  className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-2 text-sm ${category === c ? 'border-accent bg-accent text-ink' : 'border-line'}`}
                >
                  <input
                    type="radio"
                    name="category"
                    value={c}
                    checked={category === c}
                    onChange={() => setCategory(c)}
                    className="sr-only"
                  />
                  {tc(c)}
                </label>
              ))}
            </div>
            <p className="text-xs text-fog">{t(`form.lifetime.${category}`)}</p>
          </fieldset>
          <Field
            label={t('form.caption')}
            htmlFor="caption"
            hint={t('form.captionHint', { count: caption.length })}
          >
            <textarea
              id="caption"
              className={`${inputClass} min-h-20`}
              maxLength={CAPTION_MAX}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </Field>
          {category === 'event' && (
            <Field label={t('form.eventEnd')} htmlFor="event-end" hint={t('form.eventEndHint')}>
              <input
                id="event-end"
                type="datetime-local"
                required
                min={minEvent}
                max={maxEvent}
                className={inputClass}
                value={eventEnd}
                onChange={(e) => setEventEnd(e.target.value)}
              />
            </Field>
          )}
          {category === 'shop' && (
            <Field label={t('form.merchantDuration')} htmlFor="merchant-hours">
              <select
                id="merchant-hours"
                className={inputClass}
                value={merchantHours}
                onChange={(e) => setMerchantHours(Number(e.target.value))}
              >
                {MERCHANT_DURATIONS_H.map((h) => (
                  <option key={h} value={h}>
                    {t('form.hours', { count: h })}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {error && <Notice kind="error">{error}</Notice>}
          {step === 'sending' && (
            <div role="status" className="flex flex-col gap-2">
              <p>{t('form.uploading', { percent: progress })}</p>
              <progress
                value={progress}
                max={100}
                className="w-full accent-[var(--color-accent)]"
              />
            </div>
          )}
          <Button
            type="submit"
            disabled={step === 'sending' || locating || (category === 'event' && !eventEnd)}
          >
            {locating
              ? t('form.locating')
              : error && /±/.test(error)
                ? t('location.retry')
                : t('form.publish')}
          </Button>
        </form>
      )}

      {(step === 'done' || step === 'queued') && (
        <div className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-4 p-6 text-center">
          <Notice kind="success">
            {step === 'done' ? t('form.processing') : t('offline.queued')}
          </Notice>
          <Link href="/me" className="rounded-xl bg-accent px-4 py-3 font-semibold text-ink">
            {t('form.seeStatus')}
          </Link>
          <Button
            variant="ghost"
            onClick={() => {
              setRec(null);
              setCaption('');
              setProgress(0);
              setStep('camera');
            }}
          >
            {t('form.another')}
          </Button>
        </div>
      )}
    </div>
  );
}
