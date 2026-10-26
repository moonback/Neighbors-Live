'use client';

import { MAX_RECORDING_MS } from '@nl/shared';
import { useTranslations } from 'next-intl';
import type { PointerEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Notice } from '@/components/ui';
import { pickMimeType } from '@/lib/recorder';

export interface Recording {
  blob: Blob;
  mime: string;
  durationMs: number;
}

type CamError = 'denied' | 'notFound' | 'unsupported' | 'generic';
type Facing = 'environment' | 'user';
/** A specific camera (deviceId) once devices are known, otherwise a facing preference. */
interface Target {
  deviceId: string | null;
  facing: Facing;
}

interface ZoomRange {
  min: number;
  max: number;
  step: number;
}

const supportedMime = () =>
  typeof MediaRecorder === 'undefined'
    ? null
    : pickMimeType((m) => MediaRecorder.isTypeSupported(m));

async function openCamera(target: Target): Promise<MediaStream | CamError> {
  if (!navigator.mediaDevices?.getUserMedia || !supportedMime()) return 'unsupported';
  const size = { width: { ideal: 720 }, height: { ideal: 1280 } };
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: target.deviceId
        ? { deviceId: { exact: target.deviceId }, ...size }
        : { facingMode: { ideal: target.facing }, ...size },
      audio: true,
    });
  } catch (e) {
    const name = (e as DOMException).name;
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
    return name === 'NotFoundError' ? 'notFound' : 'generic';
  }
}

/** Labels are only exposed after permission; "front"/"user"/"facetime" mark a selfie camera. */
const looksFront = (label: string) => /front|user|facetime|avant|selfie/i.test(label);
const lensLevel = (label: string): 0.5 | 1 | 2 | null => {
  if (/ultra.?wide|ultra.?grand.?angle|0[.,]5\s*x|0[.,]5x/i.test(label)) return 0.5;
  if (/tele(photo)?|2\s*x|2x|3\s*x|3x/i.test(label)) return 2;
  if (/back|rear|environment|arrière|principale|main/i.test(label)) return 1;
  return null;
};

/**
 * Full-screen camera: back camera by default, switch between every available camera (button or
 * double tap), flashlight when supported, 30 s max with a gauge.
 * Only `getUserMedia` + `MediaRecorder` are used: there is no file picker (no gallery import).
 */
export function Camera({ onRecorded }: { onRecorded: (r: Recording) => void }) {
  const t = useTranslations('capture');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const pointersRef = useRef(new Map<number, number>());
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const zoomRef = useRef(1);
  const lastGood = useRef<Target | null>(null);
  const [target, setTarget] = useState<Target>({ deviceId: null, facing: 'environment' });
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [current, setCurrent] = useState<{ deviceId: string; front: boolean } | null>(null);
  const [torch, setTorch] = useState<{ supported: boolean; on: boolean }>({
    supported: false,
    on: false,
  });
  const [badge, setBadge] = useState<'front' | 'back' | null>(null);
  const [switchFailed, setSwitchFailed] = useState(false);
  const [error, setError] = useState<CamError | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [ready, setReady] = useState(false);
  const [zoomRange, setZoomRange] = useState<ZoomRange | null>(null);
  const [zoom, setZoom] = useState(1);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    let cancelled = false;
    // Many Android devices cannot open a second camera while one is live: release it first.
    stopTracks();
    void openCamera(target).then(async (result) => {
      if (typeof result === 'string') {
        if (cancelled) return;
        const previous = lastGood.current;
        if (previous && previous !== target) {
          setSwitchFailed(true);
          setTarget(previous);
        } else setError(result);
        return;
      }
      if (cancelled) {
        result.getTracks().forEach((tr) => tr.stop());
        return;
      }
      streamRef.current = result;
      lastGood.current = target;
      if (videoRef.current) videoRef.current.srcObject = result;

      const track = result.getVideoTracks()[0];
      const settings = track?.getSettings();
      const front = settings?.facingMode
        ? settings.facingMode === 'user'
        : looksFront(track?.label ?? '') || target.facing === 'user';
      setCurrent(settings?.deviceId ? { deviceId: settings.deviceId, front } : null);
      const caps = track?.getCapabilities?.() as { torch?: boolean; zoom?: ZoomRange } | undefined;
      setTorch({ supported: Boolean(caps?.torch), on: false });
      const range = caps?.zoom;
      setZoomRange(
        range && Number.isFinite(range.min) && Number.isFinite(range.max)
          ? { min: range.min, max: range.max, step: range.step || 0.1 }
          : null,
      );
      setBadge(front ? 'front' : 'back');
      setError(null);
      setReady(true);

      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      if (!cancelled) setCameras(devices.filter((d) => d.kind === 'videoinput' && d.deviceId));
    });
    return () => {
      cancelled = true;
    };
  }, [target]);

  useEffect(() => () => stopTracks(), []);

  useEffect(() => {
    if (!badge) return;
    const timer = setTimeout(() => setBadge(null), 1500);
    return () => clearTimeout(timer);
  }, [badge]);

  useEffect(() => {
    if (!switchFailed) return;
    const timer = setTimeout(() => setSwitchFailed(false), 3000);
    return () => clearTimeout(timer);
  }, [switchFailed]);

  const canSwitch = cameras.length > 1 || cameras.length === 0;
  const physicalLenses = cameras.flatMap((camera) => {
    if (looksFront(camera.label)) return [];
    const level = lensLevel(camera.label);
    return level === null ? [] : [{ camera, level }];
  });
  const zoomLevels = [0.5, 1, 2].filter((level) => {
    const hasPhysicalLens = physicalLenses.some((lens) => lens.level === level);
    const hasDigitalRange = zoomRange
      ? level >= zoomRange.min && level <= zoomRange.max
      : level >= 1;
    return hasPhysicalLens || hasDigitalRange;
  });

  const setZoomLevel = useCallback(
    (value: number) => {
      const min = zoomRange?.min ?? 1;
      const max = zoomRange?.max ?? 3;
      const next = Math.min(max, Math.max(min, value));
      zoomRef.current = next;
      setZoom(next);
    },
    [zoomRange],
  );

  useEffect(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !zoomRange || !('zoom' in zoomRange)) return;
    void track.applyConstraints({ advanced: [{ zoom } as MediaTrackConstraintSet] }).catch(() => {
      // Keep the CSS zoom as a graceful fallback on browsers that expose but reject zoom.
      setZoomRange(null);
    });
  }, [zoom, zoomRange]);

  function onPointerDown(event: PointerEvent<HTMLVideoElement>) {
    pointersRef.current.set(event.pointerId, event.clientX);
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = { distance: Math.abs(a! - b!), zoom: zoomRef.current };
    }
  }

  function onPointerMove(event: PointerEvent<HTMLVideoElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, event.clientX);
    if (pointersRef.current.size !== 2 || !pinchRef.current) return;
    const [a, b] = [...pointersRef.current.values()];
    const distance = Math.abs(a! - b!);
    if (pinchRef.current.distance > 0) {
      setZoomLevel(pinchRef.current.zoom * (distance / pinchRef.current.distance));
    }
  }

  function onPointerUp(event: PointerEvent<HTMLVideoElement>) {
    pointersRef.current.delete(event.pointerId);
    pinchRef.current = null;
  }

  function selectLens(level: number) {
    const lens = physicalLenses.find((candidate) => candidate.level === level);
    if (lens && lens.camera.deviceId !== current?.deviceId) {
      setSwitchFailed(false);
      setReady(false);
      setZoom(1);
      zoomRef.current = 1;
      setTarget({ deviceId: lens.camera.deviceId, facing: 'environment' });
      return;
    }
    setZoomLevel(level);
  }

  const switchCamera = useCallback(() => {
    if (recording || !ready) return;
    setSwitchFailed(false);
    setReady(false);
    // With known devices, cycle through all of them (front, back, wide, external webcam…);
    // otherwise fall back to flipping the facing preference.
    if (cameras.length > 1) {
      const index = cameras.findIndex((c) => c.deviceId === current?.deviceId);
      const next = cameras[(index + 1) % cameras.length]!;
      setTarget({
        deviceId: next.deviceId,
        facing: looksFront(next.label) ? 'user' : 'environment',
      });
    } else {
      setTarget((prev) => ({
        deviceId: null,
        facing: prev.facing === 'environment' ? 'user' : 'environment',
      }));
    }
  }, [cameras, current, ready, recording]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const on = !torch.on;
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      setTorch({ supported: true, on });
    } catch {
      setTorch({ supported: false, on: false });
    }
  }

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
  const mirrored = current?.front ?? target.facing === 'user';

  if (error) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <Notice kind="error">{t(`errors.${error}`)}</Notice>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        aria-label={t('title')}
        onDoubleClick={canSwitch ? switchCamera : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ transform: `${mirrored ? 'scaleX(-1) ' : ''}scale(${zoomRange ? 1 : zoom})` }}
        className={`h-full w-full touch-none object-cover transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`}
      />
      {!ready && (
        <p
          role="status"
          className="glass absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full px-4 py-2 text-sm"
        >
          <span
            aria-hidden="true"
            className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white motion-safe:animate-spin"
          />
          {t('starting')}
        </p>
      )}

      <div className="absolute inset-x-0 top-0 h-1.5 bg-white/15" aria-hidden="true">
        <div className="h-full bg-accent" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="absolute inset-x-0 top-[calc(1rem+env(safe-area-inset-top))] flex flex-col items-center gap-2">
        {ready && !recording && (
          <div
            className="glass flex items-center gap-1 rounded-full p-1"
            aria-label={t('zoom.label')}
          >
            {zoomLevels.map((level) => {
              const lens = physicalLenses.find((candidate) => candidate.level === level);
              const selected = lens
                ? lens.camera.deviceId === current?.deviceId
                : Math.abs(zoom - level) < 0.08;
              return (
                <button
                  key={level}
                  type="button"
                  aria-label={t(`zoom.${level === 0.5 ? 'wide' : level === 2 ? 'tele' : 'level'}`, {
                    level,
                  })}
                  aria-pressed={selected}
                  onClick={() => selectLens(level)}
                  className="min-h-11 min-w-11 rounded-full px-3 text-xs font-semibold text-white transition active:scale-95 aria-pressed:bg-white aria-pressed:text-ink"
                >
                  {level.toLocaleString(undefined, { maximumFractionDigits: 1 })}×
                </button>
              );
            })}
          </div>
        )}
        <p
          className={`glass flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold ${recording ? 'border-alert/60!' : ''}`}
          aria-live="polite"
        >
          {recording && (
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full bg-alert motion-safe:animate-pulse"
            />
          )}
          {recording ? t('remaining', { seconds: remaining }) : t('maxDuration')}
        </p>
        {badge && !recording && (
          <p className="glass rounded-full px-3 py-1 text-xs text-white/90" aria-hidden="true">
            {t(badge)}
          </p>
        )}
        {switchFailed && (
          <p role="alert" className="rounded-full bg-alert/90 px-3 py-1 text-xs font-semibold">
            {t('switchFailed')}
          </p>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 bg-gradient-to-t from-black/70 to-transparent pt-16 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {canSwitch && !recording && ready && (
          <p className="text-xs text-white/70">{t('switchHint')}</p>
        )}
        <div className="grid w-full max-w-sm grid-cols-3 place-items-center">
          {torch.supported ? (
            <ControlButton
              label={torch.on ? t('torchOff') : t('torchOn')}
              pressed={torch.on}
              onClick={toggleTorch}
              icon="M9 2h6l-1 7h4l-8 13 2-9H8z"
            />
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={recording ? stop : record}
            disabled={!ready}
            aria-label={recording ? t('stop') : t('record')}
            className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/90 transition active:scale-95 disabled:opacity-50"
          >
            <svg className="absolute -inset-1 -rotate-90" viewBox="0 0 88 88" aria-hidden="true">
              <circle
                cx="44"
                cy="44"
                r="40"
                fill="none"
                stroke="var(--color-alert)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={251}
                strokeDashoffset={251 * (1 - progress)}
              />
            </svg>
            <span
              className={`bg-alert shadow-[0_0_24px_rgba(255,77,109,0.7)] transition-all ${recording ? 'h-7 w-7 rounded-md' : 'h-14 w-14 rounded-full'}`}
            />
          </button>
          {canSwitch ? (
            <ControlButton
              label={t('switch')}
              disabled={recording || !ready}
              onClick={switchCamera}
              icon="M20 7h-3.2L15 5H9L7.2 7H4v12h16zM9 13.5a3 3 0 015-2.2l1-1M15 12.5a3 3 0 01-5 2.2l-1 1"
            />
          ) : (
            <span />
          )}
        </div>
      </div>
    </div>
  );
}

function ControlButton({
  label,
  icon,
  onClick,
  pressed,
  disabled,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-14 w-14 items-center justify-center rounded-full transition active:scale-90 disabled:opacity-40 ${pressed ? 'bg-amber-300 text-ink' : 'glass text-white'}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d={icon} />
      </svg>
    </button>
  );
}
