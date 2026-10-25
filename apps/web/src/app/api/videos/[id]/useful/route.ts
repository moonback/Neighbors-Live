import { z } from 'zod';
import { json, requireUser, route, unwrap } from '@/lib/api';
import { createClient } from '@/lib/supabase/server';

type Ctx = { params: Promise<{ id: string }> };

async function usefulCount(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data } = await supabase.from('videos').select('useful_count').eq('id', id).maybeSingle();
  return data?.useful_count ?? 0;
}

/** "Utile": one per user and video, enforced by RLS + primary key. */
export const POST = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const id = z.uuid().parse((await params).id);
  const supabase = await createClient();
  const res = await supabase.from('reactions').insert({ video_id: id, user_id: user.id });
  if (res.error && res.error.code !== '23505') unwrap(res);
  return json({ reacted: true, usefulCount: await usefulCount(supabase, id) });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const id = z.uuid().parse((await params).id);
  const supabase = await createClient();
  unwrap(await supabase.from('reactions').delete().eq('video_id', id).eq('user_id', user.id));
  return json({ reacted: false, usefulCount: await usefulCount(supabase, id) });
});
