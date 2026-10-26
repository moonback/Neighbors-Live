'use client';

import { RAW_BUCKET } from '@nl/shared';
import { Upload } from 'tus-js-client';
import { api } from '@/lib/client-api';
import { clientEnv } from '@/lib/env';
import { browserClient } from '@/lib/supabase/browser';

export interface PublishMeta {
  category: string;
  caption: string;
  mimeType: 'video/mp4' | 'video/webm';
  durationMs: number;
  eventEndsAt?: string;
  merchantHours?: number;
}

export interface Fix {
  lat: number;
  lng: number;
  accuracy: number;
}

export class PublishError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly reserved?: { videoId: string; uploadPath: string };
  constructor(
    code: string,
    retryable: boolean,
    reserved?: { videoId: string; uploadPath: string },
  ) {
    super(code);
    this.code = code;
    this.retryable = retryable;
    this.reserved = reserved;
  }
}

/** Resumable upload (TUS, 6 MB chunks as required by Supabase) with automatic retries. */
function tusUpload(
  file: Blob,
  path: string,
  contentType: string,
  token: string,
  onProgress: (p: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: `${clientEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${token}`, 'x-upsert': 'false' },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: { bucketName: RAW_BUCKET, objectName: path, contentType, cacheControl: '3600' },
      chunkSize: 6 * 1024 * 1024,
      onError: reject,
      onProgress: (sent, total) => onProgress(total ? Math.round((sent / total) * 100) : 0),
      onSuccess: () => resolve(),
    });
    void upload.findPreviousUploads().then((previous) => {
      if (previous[0]) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    });
  });
}

/**
 * Full publication: reserve (server validation) → resumable upload → confirm.
 * `existingVideoId` lets the offline queue resume a publication already reserved.
 */
export async function publish(
  file: Blob,
  meta: PublishMeta,
  fix: Fix,
  onProgress: (percent: number) => void,
  existing?: { videoId: string; uploadPath: string },
  requestId = crypto.randomUUID(),
): Promise<{ videoId: string }> {
  let target = existing;
  if (!target) {
    const res = await api<{ videoId: string; uploadPath: string }>('/api/videos', {
      body: { ...meta, ...fix, sizeBytes: file.size, requestId },
    });
    if (!res.ok) throw new PublishError(res.error, res.status === 0);
    target = res.data;
  }
  const { data } = await browserClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new PublishError('unauthorized', true, target);
  try {
    await tusUpload(file, target.uploadPath, meta.mimeType, token, onProgress);
  } catch {
    throw new PublishError('network', true, target);
  }
  const done = await api(`/api/videos/${target.videoId}/uploaded`, { body: {} });
  if (!done.ok) throw new PublishError(done.error, done.status === 0);
  return { videoId: target.videoId };
}
