import { MAX_UPLOAD_BYTES, rawPathFor, RAW_BUCKET } from '@nl/shared';
import { z } from 'zod';
import { ApiError, json, requireUser, route, unwrap } from '@/lib/api';
import { adminClient } from '@/lib/supabase/admin';

/** Step 3 of a publication: the raw file is verified in storage, then queued for the worker. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const user = await requireUser();
  const id = z.uuid().parse((await params).id);
  const admin = adminClient();
  const { data: video } = await admin
    .from('videos')
    .select('mime_type, status, raw_path')
    .eq('id', id)
    .eq('author_id', user.id)
    .maybeSingle();
  if (!video) throw new ApiError('not_found', 404);
  if (video.status !== 'processing' || video.raw_path) return json({ status: video.status });

  const path = rawPathFor(user.id, id, video.mime_type);
  const name = path.split('/')[1] ?? '';
  const { data: files } = await admin.storage.from(RAW_BUCKET).list(user.id, { search: name });
  const file = files?.find((f) => f.name === name);
  if (!file) throw new ApiError('upload_missing', 409);
  const size = Number((file.metadata as { size?: number } | null)?.size ?? 0);
  if (size <= 0 || size > MAX_UPLOAD_BYTES) {
    await admin.storage.from(RAW_BUCKET).remove([path]);
    throw new ApiError('invalid_input', 422);
  }
  unwrap(
    await admin.rpc('enqueue_processing', { p_author: user.id, p_video: id, p_raw_path: path }),
  );
  return json({ status: 'processing' });
});
