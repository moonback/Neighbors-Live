import { reportSchema } from '@nl/shared';
import { z } from 'zod';
import { ApiError, json, parseBody, requireUser, route, unwrap } from '@/lib/api';
import { createClient } from '@/lib/supabase/server';

/**
 * Report with a reason. RLS forbids reporting one's own or invisible videos; a trigger
 * rate-limits and auto-hides the video at 3 distinct reporters (apply_report_threshold).
 */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const user = await requireUser();
  const id = z.uuid().parse((await params).id);
  const { reason, details } = await parseBody(req, reportSchema);
  const supabase = await createClient();
  const res = await supabase
    .from('reports')
    .insert({ video_id: id, reporter_id: user.id, reason, details: details ?? '' });
  if (res.error?.code === '23505') throw new ApiError('already_reported', 409);
  unwrap(res);
  return json({ ok: true }, 201);
});
