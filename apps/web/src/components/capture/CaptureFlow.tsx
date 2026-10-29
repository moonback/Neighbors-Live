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
import { useEffect, useMemo, useRef, useState } from 'react';
import { PermissionPrimer } from '@/components/PermissionPrimer';
import { Button, Field, inputClass, Notice } from '@/components/ui';
import { useErrorText } from '@/components/useErrorText';
import { enqueue } from '@/lib/offline-queue';
import { currentPosition } from '@/lib/platform';
import { publish, PublishError, type Fix, type PublishMeta } from '@/lib/publish';
import { containerOf } from '@/lib/recorder';
import { Camera, type Recording } from './Camera';

type Step = 'primer' | 'camera' | 'preview' | 'form' | 'sending' | 'done' | 'queued';
const LOCATION_MAX_AGE_MS = 5 * 60_000;

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
  const [offerTerms, setOfferTerms] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [merchantHours, setMerchantHours] = useState<number>(24);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locationSnapshot, setLocationSnapshot] = useState<{
    fix: Fix;
    capturedAt: number;
  } | null>(null);
  const [locationStale, setLocationStale] = useState(false);
  const locationRequestId = useRef(0);

  const previewUrl = useMemo(() => (rec ? URL.createObjectURL(rec.blob) : null), [rec]);
  useEffect(() => () => void (previewUrl && URL.revokeObjectURL(previewUrl)), [previewUrl]);
  useEffect(() => {
    if (!locationSnapshot) return;
    const timeout = window.setTimeout(
      () => setLocationStale(true),
      Math.max(0, locationSnapshot.capturedAt + LOCATION_MAX_AGE_MS - Date.now() + 1),
    );
    return () => window.clearTimeout(timeout);
  }, [locationSnapshot]);

  const categories = CATEGORIES.filter((c) => c !== 'shop' || isMerchant);

  async function locate() {
    const requestId = ++locationRequestId.current;
    setLocating(true);
    setError(null);
    try {
      const pos = await currentPosition();
      const fix = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: Math.ceil(pos.coords.accuracy),
      };
      if (fix.accuracy > MAX_ACCURACY_M) {
        if (locationRequestId.current === requestId) {
          setError(t('location.imprecise', { accuracy: fix.accuracy }));
        }
        return null;
      }
      const snapshot = { fix, capturedAt: pos.timestamp };
      if (locationRequestId.current === requestId) {
        setLocationStale(false);
        setLocationSnapshot(snapshot);
      }
      return snapshot;
    } catch (e) {
      if (locationRequestId.current === requestId) {
        setError(
          (e as GeolocationPositionError).code === 1
            ? t('location.denied')
            : t('location.unavailable'),
        );
      }
      return null;
    } finally {
      if (locationRequestId.current === requestId) setLocating(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rec) return;
    setError(null);
    const locationIsFresh =
      locationSnapshot !== null && Date.now() - locationSnapshot.capturedAt <= LOCATION_MAX_AGE_MS;
    const snapshot = locationIsFresh ? locationSnapshot : await locate();
    if (!snapshot) return;
    const fix = snapshot.fix;
    const meta: PublishMeta = {
      category,
      caption,
      mimeType: containerOf(rec.mime),
      durationMs: rec.durationMs,
      ...(category === 'event' && eventEnd && { eventEndsAt: new Date(eventEnd).toISOString() }),
      ...(category === 'shop' && { merchantHours, offerTerms }),
    };
    const requestId = crypto.randomUUID();
    const keepForLater = async (error?: unknown) => {
      const reserved = error instanceof PublishError ? error.reserved : undefined;
      await enqueue({
        id: requestId,
        blob: rec.blob,
        meta,
        fix,
        createdAt: Date.now(),
        reserved,
      });
      setStep('queued');
    };
    if (!navigator.onLine) return keepForLater();
    setStep('sending');
    try {
      await publish(rec.blob, meta, fix, setProgress, undefined, requestId);
      setStep('done');
    } catch (err) {
      if (err instanceof PublishError && err.retryable) return keepForLater(err);
      setStep('form');
      const code = err instanceof PublishError ? err.code : 'generic';
      setError(t.has(`errorsPublish.${code}`) ? t(`errorsPublish.${code}`) : errorText(code));
    }
  }

  const [{ minEvent, maxEvent }] = useState(eventBounds);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink">
      <header className="absolute inset-x-0 top-0 z-10 flex justify-end px-3 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
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
            setLocationSnapshot(null);
            setError(null);
            setRec(r);
            setStep('preview');
            void locate();
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
          <div aria-live="polite" className="px-4 text-center text-sm text-fog">
            {locating ? t('location.capturing') : locationSnapshot ? t('location.captured') : error}
          </div>
          <div className="flex gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                locationRequestId.current += 1;
                setLocating(false);
                setLocationSnapshot(null);
                setError(null);
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
          className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[calc(4rem+env(safe-area-inset-top))] sm:px-6"
        >
          <h1 className="text-2xl font-bold">{t('form.title')}</h1>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t('form.category')}</legend>
            <div className="grid grid-cols-3 gap-2">
              {categories.map((c) => (
                <label
                  key={c}
                  className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-2 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${category === c ? 'border-accent bg-accent text-ink' : 'border-line'}`}
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
            hint={`${t(`form.captionGuide.${category}`)} ${t('form.captionHint', { count: caption.length })}`}
          >
            <textarea
              id="caption"
              className={`${inputClass} min-h-20`}
              maxLength={CAPTION_MAX}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t(`form.captionPlaceholder.${category}`)}
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
            <Field label={t('form.offerTerms')} htmlFor="offer-terms">
              <textarea
                id="offer-terms"
                className={`${inputClass} min-h-20`}
                maxLength={280}
                required
                value={offerTerms}
                onChange={(e) => setOfferTerms(e.target.value)}
                placeholder={t('form.offerTermsPlaceholder')}
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
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-sm font-semibold">{t('form.safety.title')}</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-fog">
              <li>{t('form.safety.people')}</li>
              <li>{t('form.safety.plates')}</li>
              <li>{t('form.safety.emergency')}</li>
            </ul>
          </section>
          <section
            aria-live="polite"
            aria-label={t('form.preview.title')}
            className="rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <h2 className="text-sm font-semibold">{t('form.preview.title')}</h2>
            <p className="mt-2 text-xs text-accent">{tc(category)}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">
              {caption.trim() || t('form.preview.emptyCaption')}
            </p>
            {category === 'shop' && (
              <div className="mt-2 text-sm">
                <p className="text-xs font-semibold text-fog">{t('form.offerTerms')}</p>
                <p className="mt-1 whitespace-pre-wrap">
                  {offerTerms.trim() || t('form.offerTermsMissing')}
                </p>
              </div>
            )}
            {category === 'event' && eventEnd && (
              <p className="mt-2 text-xs text-fog">
                {t('form.preview.eventEnd', {
                  date: new Intl.DateTimeFormat(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(eventEnd)),
                })}
              </p>
            )}
            {category === 'shop' && (
              <p className="mt-2 text-xs text-fog">{t('form.hours', { count: merchantHours })}</p>
            )}
          </section>
          <section aria-live="polite" className="flex items-center justify-between gap-3">
            <p className="text-sm text-fog">
              {locating
                ? t('location.capturing')
                : locationSnapshot
                  ? locationStale
                    ? t('location.stale')
                    : t('location.captured')
                  : t('location.missing')}
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void locate()}
              disabled={locating || step === 'sending'}
            >
              {locating ? t('form.locating') : t('location.refresh')}
            </Button>
          </section>
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
          <div className="sticky bottom-0 -mx-4 mt-auto bg-gradient-to-t from-ink via-ink/95 to-ink/80 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:px-6">
            <Button
              type="submit"
              className="w-full"
              disabled={
                step === 'sending' ||
                locating ||
                (category === 'event' && !eventEnd) ||
                (category === 'shop' && offerTerms.trim().length < 3)
              }
            >
              {locating
                ? t('form.locating')
                : error && /±/.test(error)
                  ? t('location.retry')
                  : t('form.publish')}
            </Button>
          </div>
        </form>
      )}

      {(step === 'done' || step === 'queued') && (
        <div className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-4 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
          <Notice kind="success">
            {step === 'done' ? t('form.processing') : t('offline.queued')}
          </Notice>
          <Link
            href="/me?tab=status"
            className="rounded-xl bg-accent px-4 py-3 font-semibold text-ink"
          >
            {t('form.seeStatus')}
          </Link>
          <Button
            variant="ghost"
            onClick={() => {
              locationRequestId.current += 1;
              setLocating(false);
              setLocationSnapshot(null);
              setError(null);
              setRec(null);
              setCaption('');
              setOfferTerms('');
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
