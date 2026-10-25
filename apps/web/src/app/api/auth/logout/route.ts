import { json, route } from '@/lib/api';
import { createClient } from '@/lib/supabase/server';

export const POST = route(async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return json({ ok: true });
});
