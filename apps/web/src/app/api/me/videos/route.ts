import { json, requireUser, route, unwrap } from '@/lib/api';
import { createClient } from '@/lib/supabase/server';

/** The author's own videos, whatever their status (RLS: owner sees all of theirs). */
export const GET = route(async () => {
  const user = await requireUser();
  const supabase = await createClient();
  const videos = unwrap(
    await supabase
      .from('videos')
      .select('id, category, caption, status, hidden_reason, created_at, expires_at')
      .eq('author_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
  );
  return json({ videos });
});
