import { commentSchema } from '@nl/shared';
import { z } from 'zod';
import { json, parseBody, requireUser, route, unwrap } from '@/lib/api';
import { createClient } from '@/lib/supabase/server';

type Ctx = { params: Promise<{ id: string }> };
const PAGE = 20;
const beforeSchema = z.iso.datetime({ offset: true }).optional();
interface CommentRow {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author: { username: string | null; avatar_color: string } | null;
}

const columns = 'id, body, created_at, author_id, author:profiles(username, avatar_color)';

/** Comments, newest first, paginated with a `before` timestamp cursor. */
export const GET = route<Ctx>(async (req, { params }) => {
  const id = z.uuid().parse((await params).id);
  const before = beforeSchema.parse(req.nextUrl.searchParams.get('before') ?? undefined);
  const supabase = await createClient();
  let query = supabase
    .from('comments')
    .select(columns)
    .eq('video_id', id)
    .order('created_at', { ascending: false })
    .limit(PAGE);
  if (before) query = query.lt('created_at', before);
  const rows = unwrap(await query);
  const { data } = await supabase.auth.getUser();
  return json({
    comments: rows.map((c) => ({ ...c, mine: c.author_id === data.user?.id })),
    nextBefore: rows.length === PAGE ? (rows.at(-1)?.created_at ?? null) : null,
  });
});

/** Text is sanitised by the schema; RLS checks authorship and ban, a trigger rate-limits. */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const id = z.uuid().parse((await params).id);
  const { body } = await parseBody(req, commentSchema);
  const supabase = await createClient();
  const comment = unwrap<CommentRow>(
    await supabase
      .from('comments')
      .insert({ video_id: id, author_id: user.id, body })
      .select(columns)
      .single(),
  );
  return json({ ...comment, mine: true }, 201);
});
