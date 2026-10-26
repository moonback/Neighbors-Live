'use client';

import { MAX_RECORDING_MS } from '@nl/shared';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Notice } from '@/components/ui';
import { pickMimeType } from '@/lib/recorder';

export interface Recording {
  blob: Blob;
  mime: string;
  durationMs: number;
}

type CamError = 'denied' | 'notFound' | 'unsupported' | 'generic';

const supportedMime = () =>
  typeof MediaRecorder === 'undefined'
    ? null
    : pickMimeType((m) => MediaRecorder.isTypeSupported(m));

async function openCamera(facing: 'environment' | 'user'): Promise<MediaStream | CamError> {
  if (!navigator.mediaDevices?.getUserMedia || !supportedMime()) return 'unsupported';
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facing }, width: { ideal: 720 }, height: { ideal: 1280 } },
      audio: true,
    });
  } catch (e) {
    const name = (e as DOMException).name;
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
    return name === 'NotFoundError' ? 'notFound' : 'generic';
  }
}

/**
 * Full-screen camera: back camera by default, front/back switch, 30 s max with a gauge.
 * Only `getUserMedia` + `MediaRecorder` are used: there is no file picker (no gallery import).
 */
export function Camera({ onRecorded }: { onRecorded: (r: Recording) => void }) {
  const t = useTranslations('capture');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState<CamError | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [ready, setReady] = useState(false);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    let cancelled = false;
    void openCamera(facing).then((result) => {
      if (typeof result === 'string') {
        if (!cancelled) setError(result);
        return;
      }
      if (cancelled) {
        result.getTracks().forEach((tr) => tr.stop());
        return;
      }
      stopTracks();
      streamRef.current = result;
      if (videoRef.current) videoRef.current.srcObject = result;
      setError(null);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [facing]);

  useEffect(() => () => stopTracks(), []);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  function record() {
    const stream = streamRef.current;
    const mime = supportedMime();
    if (!stream || !mime) return;
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
    const startedAt = performance.now();
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      setRecording(false);
      const durationMs = Math.min(MAX_RECORDING_MS, Math.round(performance.now() - startedAt));
      stopTracks();
      onRecorded({ blob: new Blob(chunks, { type: mime }), mime, durationMs });
    };
    recorderRef.current = recorder;
    recorder.start(1000);
    setRecording(true);
    setElapsed(0);
    const tick = () => {
      if (recorder.state !== 'recording') return;
      const ms = performance.now() - startedAt;
      setElapsed(ms);
      if (ms >= MAX_RECORDING_MS) recorder.stop();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  const progress = Math.min(1, elapsed / MAX_RECORDING_MS);
  const remaining = Math.max(0, Math.ceil((MAX_RECORDING_MS - elapsed) / 1000));

  if (error) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <Notice kind="error">{t(`errors.${error}`)}</Notice>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        aria-label={t('title')}
        className={`h-full w-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`}
      />
      <div className="absolute inset-x-0 top-0 h-1.5 bg-white/20" aria-hidden="true">
        <div className="h-full bg-alert" style={{ width: `${progress * 100}%` }} />
      </div>
      <p
        className="absolute left-1/2 top-[calc(1rem+env(safe-area-inset-top))] -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm"
        aria-live="polite"
      >
        {recording ? t('remaining', { seconds: remaining }) : t('maxDuration')}
      </p>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-around pb-[max(2rem,env(safe-area-inset-bottom))]">
        <span className="w-14" />
        <button
          type="button"
          onClick={recording ? stop : record}
          disabled={!ready}
          aria-label={recording ? t('stop') : t('record')}
          className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-white"
        >
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80" aria-hidden="true">
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="var(--color-alert)"
              strokeWidth="6"
              strokeDasharray={226}
              strokeDashoffset={226 * (1 - progress)}
            />
          </svg>
          <span
            className={`bg-alert transition-all ${recording ? 'h-7 w-7 rounded-md' : 'h-14 w-14 rounded-full'}`}
          />
        </button>
        <Button
          variant="secondary"
          className="h-14 w-14 rounded-full p-0"
          aria-label={t('switch')}
          disabled={recording}
          onClick={() => {
            setReady(false);
            setFacing((f) => (f === 'environment' ? 'user' : 'environment'));
          }}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 7h3l2-2h6l2 2h3v12H4zM9 13a3 3 0 015-2.2M15 13a3 3 0 01-5 2.2" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
