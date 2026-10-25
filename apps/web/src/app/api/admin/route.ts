import { sanitizeText } from '@nl/shared';
import { z } from 'zod';
import { json, parseBody, requireUser, route, unwrap } from '@/lib/api';
import { adminClient } from '@/lib/supabase/admin';

const note = z.string().transform(sanitizeText).pipe(z.string().min(3).max(1000));

const schema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ban'), userId: z.uuid(), banned: z.boolean(), note }),
  z.object({ type: z.literal('revert'), actionId: z.number().int().positive(), note }),
  z.object({ type: z.literal('merchant'), userId: z.uuid(), approve: z.boolean() }),
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
  } else {
    unwrap(
      await admin.rpc('admin_review_merchant', {
        p_admin: user.id,
        p_user: body.userId,
        p_approve: body.approve,
      }),
    );
  }
  return json({ ok: true });
});
