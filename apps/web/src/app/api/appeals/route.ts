import { appealSchema } from '@nl/shared';
import { z } from 'zod';
import { ApiError, json, parseBody, requireUser, route, unwrap } from '@/lib/api';
import { createClient } from '@/lib/supabase/server';

const schema = appealSchema.extend({ actionId: z.number().int().positive() });

/** The author contests a decision about them (RLS: target only, once, within 30 days). */
export const POST = route(async (req) => {
  const user = await requireUser();
  const { actionId, reason } = await parseBody(req, schema);
  const supabase = await createClient();
  const res = await supabase
    .from('appeals')
    .insert({ action_id: actionId, author_id: user.id, reason });
  if (res.error?.code === '23505') throw new ApiError('already_appealed', 409);
  unwrap(res);
  return json({ ok: true }, 201);
});
