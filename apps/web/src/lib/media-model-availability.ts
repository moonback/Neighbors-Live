type WorkerStatus = { detectors: unknown; last_seen: string };
export type ModelAvailability = {
  available: boolean;
  reason: 'ready' | 'disabled' | 'not_configured' | 'worker_offline' | 'model_unavailable';
};

export function mediaModelAvailability(
  env: NodeJS.ProcessEnv,
  workers: WorkerStatus[],
  now = Date.now(),
) {
  const active = workers.filter((worker) => now - Date.parse(worker.last_seen) < 90_000);
  const model = (
    key: 'faces' | 'plates',
    envEnabled: boolean,
    pathConfigured: boolean,
  ): ModelAvailability => {
    if (!envEnabled) return { available: false, reason: 'disabled' };
    if (!pathConfigured) return { available: false, reason: 'not_configured' };
    if (active.length === 0) return { available: false, reason: 'worker_offline' };
    const detectorName = key === 'faces' ? 'face-yunet' : 'plate-yolo';
    if (
      !active.some(
        (worker) =>
          typeof worker.detectors === 'object' &&
          worker.detectors !== null &&
          detectorName in worker.detectors &&
          (worker.detectors as Record<string, unknown>)[detectorName] === true,
      )
    ) {
      return { available: false, reason: 'model_unavailable' };
    }
    return { available: true, reason: 'ready' };
  };
  return {
    faces: model('faces', env.FACE_BLUR_ENABLED !== 'false', true),
    plates: model(
      'plates',
      env.PLATE_BLUR_ENABLED === 'true',
      Boolean(env.PLATE_MODEL_PATH?.trim()),
    ),
  };
}
