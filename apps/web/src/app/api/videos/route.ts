import {
  computeExpiresAt,
  createVideoSchema,
  rawPathFor,
  RAW_BUCKET,
  realtimeCell,
  zoneCell,
} from '@nl/shared';
import { ApiError, json, parseBody, requireUser, route, unwrap } from '@/lib/api';
import { adminClient } from '@/lib/supabase/admin';

/**
 * Step 1 of a publication: validates everything server-side (schema, accuracy ≤ 100 m,
 * plausible position, coherence with the previous publication, rate limit, merchant quota)
 * and reserves the video row. The client then uploads the raw file (TUS) to `uploadPath`.
 */
export const POST = route(async (req) => {
  const user = await requireUser();
  const input = await parseBody(req, createVideoSchema);
  let expiresAt: Date;
  try {
    expiresAt = computeExpiresAt(input.category, new Date(), {
      eventEndsAt: input.eventEndsAt ? new Date(input.eventEndsAt) : undefined,
      merchantHours: input.merchantHours,
    });
  } catch (error) {
    throw new ApiError((error as Error).message, 422);
  }
  const point = { lat: input.lat, lng: input.lng };
  const videoId = unwrap(
    await adminClient().rpc('create_video', {
      p_author: user.id,
      p_category: input.category,
      p_caption: input.caption,
      p_lat: input.lat,
      p_lng: input.lng,
      p_accuracy: input.accuracy,
      p_h3_cell: zoneCell(point),
      p_realtime_cell: realtimeCell(point),
      p_mime: input.mimeType,
      p_duration_ms: input.durationMs,
      p_expires_at: expiresAt.toISOString(),
      p_request_id: input.requestId ?? crypto.randomUUID(),
      p_offer_terms: input.offerTerms ?? '',
    }),
  );
  if (!videoId) throw new ApiError('internal', 500);
  return json(
    { videoId, bucket: RAW_BUCKET, uploadPath: rawPathFor(user.id, videoId, input.mimeType) },
    201,
  );
});
