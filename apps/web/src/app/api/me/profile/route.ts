import { profileUpdateSchema } from '@nl/shared';
import { json, parseBody, requireUser, route, unwrap } from '@/lib/api';
import { createClient } from '@/lib/supabase/server';

const schema = profileUpdateSchema.pick({ username: true, bio: true });

/** Owner edits pseudo and bio; RLS + column grants restrict the update to these fields. */
export const PATCH = route(async (req) => {
  const user = await requireUser();
  const patch = await parseBody(req, schema);
  const supabase = await createClient();
  const updated = unwrap(
    await supabase
      .from('profiles')
      .update(patch)
      .eq('id', user.id)
      .select('username, bio')
      .single(),
  );
  return json(updated);
});
