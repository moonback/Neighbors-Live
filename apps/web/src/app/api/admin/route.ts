import { sanitizeText } from '@nl/shared';
import { z } from 'zod';
import { ApiError, json, parseBody, requireUser, route, unwrap } from '@/lib/api';
import { adminClient } from '@/lib/supabase/admin';

const note = z.string().transform(sanitizeText).pipe(z.string().min(3).max(1000));

const schema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ban'), userId: z.uuid(), banned: z.boolean(), note }),
  z.object({ type: z.literal('revert'), actionId: z.number().int().positive(), note }),
  z.object({ type: z.literal('merchant'), userId: z.uuid(), approve: z.boolean() }),
  z.object({
    type: z.literal('mediaSettings'),
    settings: z.object({
      faceBlurEnabled: z.boolean(),
      plateBlurEnabled: z.boolean(),
      detectEvery: z.number().int().min(1).max(10),
      faceMinScore: z.number().min(0.05).max(0.95),
      plateMinScore: z.number().min(0.05).max(0.95),
    }),
  }),
]);

/** Admin actions; `is_admin(actor)` is checked inside every SQL function. */
export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await parseBody(req, schema);
  const admin = adminClient();
  if (body.type === 'ban') {
    unwrap(
      await admin.rpc('admin_set_ban', {
        p_admin: user.id,
        p_user: body.userId,
        p_banned: body.banned,
        p_note: body.note,
      }),
    );
  } else if (body.type === 'revert') {
    unwrap(
      await admin.rpc('admin_revert_action', {
        p_admin: user.id,
        p_action: body.actionId,
        p_note: body.note,
      }),
    );
  } else if (body.type === 'merchant') {
    unwrap(
      await admin.rpc('admin_review_merchant', {
        p_admin: user.id,
        p_user: body.userId,
        p_approve: body.approve,
      }),
    );
  } else {
    if (
      (body.settings.faceBlurEnabled && process.env.FACE_BLUR_ENABLED === 'false') ||
      (body.settings.plateBlurEnabled &&
        (process.env.PLATE_BLUR_ENABLED !== 'true' || !process.env.PLATE_MODEL_PATH?.trim()))
    ) {
      throw new ApiError('media_model_unavailable', 409);
    }
    unwrap(
      await admin.rpc('admin_set_media_settings', {
        p_admin: user.id,
        p_settings: {
          face_blur_enabled: body.settings.faceBlurEnabled,
          plate_blur_enabled: body.settings.plateBlurEnabled,
          detect_every: body.settings.detectEvery,
          face_min_score: body.settings.faceMinScore,
          plate_min_score: body.settings.plateMinScore,
        },
      }),
    );
  }
  return json({ ok: true });
});
