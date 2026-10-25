import { MODERATION_ACTIONS, sanitizeText } from '@nl/shared';
import { z } from 'zod';
import { json, parseBody, requireUser, route, unwrap } from '@/lib/api';
import { adminClient } from '@/lib/supabase/admin';

const cell = z.string().regex(/^[0-9a-f]{15}$/);

const schema = z.discriminatedUnion('type', [
  // Same fields as moderationDecisionSchema; "note required to remove" is enforced in SQL.
  z.object({
    type: z.literal('decision'),
    videoId: z.uuid(),
    action: z.enum(MODERATION_ACTIONS),
    note: z.string().max(1000).transform(sanitizeText).default(''),
  }),
  z.object({
    type: z.literal('appeal'),
    appealId: z.uuid(),
    uphold: z.boolean(),
    note: z.string().max(1000).transform(sanitizeText).default(''),
  }),
  z.object({ type: z.literal('apply'), cell }),
]);

/**
 * Moderator actions. Authorization is enforced in SQL (zone moderator or admin, no
 * self-moderation, appeals reviewed by someone else); the actor is the verified session user.
 */
export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await parseBody(req, schema);
  const admin = adminClient();
  if (body.type === 'decision') {
    const actionId = unwrap(
      await admin.rpc('moderate_video', {
        p_actor: user.id,
        p_video: body.videoId,
        p_kind: body.action,
        p_note: body.note,
      }),
    );
    return json({ actionId });
  }
  if (body.type === 'appeal') {
    unwrap(
      await admin.rpc('resolve_appeal', {
        p_reviewer: user.id,
        p_appeal: body.appealId,
        p_uphold: body.uphold,
        p_note: body.note,
      }),
    );
    return json({ ok: true });
  }
  unwrap(await admin.rpc('become_zone_moderator', { p_user: user.id, p_cell: body.cell }));
  return json({ ok: true });
});
