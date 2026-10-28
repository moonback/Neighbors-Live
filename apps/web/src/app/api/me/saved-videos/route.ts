import { z } from 'zod';
import { json, parseBody, requireUser, route, unwrap } from '@/lib/api';
import { signMedia } from '@/lib/media';
import { adminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const payloadSchema = z.object({ videoId: z.string().uuid() });

const deleteSchema = z.object({ videoId: z.string().uuid() });

export const GET = route(async (req) => {
  const user = await requireUser();
  const videoId = req.nextUrl.searchParams.get('videoId');
  const supabase = await createClient();

  if (videoId) {
    const id = z.string().uuid().parse(videoId);

    const { data, error } = await supabase
      .from('saved_videos')
      .select('video_id')
      .eq('user_id', user.id)
      .eq('video_id', id)
      .maybeSingle();
    if (error) unwrap({ data: null, error });
    return json({ saved: !!data });
  }

  const { data: savedRows, error } = await supabase
    .from('saved_videos')
    .select('video_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  const saved = unwrap({ data: savedRows, error }) ?? [];
  if (!saved.length) return json({ videos: [] });

  const admin = adminClient();
  const { data: videoRows, error: videoError } = await admin
    .from('videos')
    .select(
      'id, author_id, category, caption, poster_path, status, published_at, expires_at, is_merchant',
    )
    .in(
      'id',
      saved.map((row) => row.video_id),
    );
  const videos = unwrap({ data: videoRows, error: videoError }) ?? [];
  const authorIds = [...new Set(videos.map((video) => video.author_id))];
  const { data: profiles, error: profilesError } = authorIds.length
    ? await admin.from('profiles').select('id, username').in('id', authorIds)
    : { data: [], error: null };
  const authorRows = unwrap({ data: profiles, error: profilesError }) ?? [];
  const authors = new Map(authorRows.map((profile) => [profile.id, profile.username]));
  const posters = await signMedia(
    videos
      .filter((video) => video.status === 'active' && new Date(video.expires_at) > new Date())
      .map((video) => video.poster_path),
  );
  const videosById = new Map(videos.map((video) => [video.id, video]));

  return json({
    videos: saved.map((row) => {
      const video = videosById.get(row.video_id);
      return {
        id: row.video_id,
        savedAt: new Date(row.created_at).getTime(),
        category: video?.category ?? null,
        caption: video?.caption ?? null,
        authorName: video ? (authors.get(video.author_id) ?? null) : null,
        posterUrl: video?.poster_path ? (posters.get(video.poster_path) ?? null) : null,
        status: video?.status ?? null,
        publishedAt: video?.published_at ?? null,
        expiresAt: video?.expires_at ?? null,
        isMerchant: video?.is_merchant ?? false,
      };
    }),
  });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const { videoId } = await parseBody(req, payloadSchema);
  const supabase = await createClient();

  const { error } = await supabase.from('saved_videos').insert({
    user_id: user.id,
    video_id: videoId,
  });
  if (error && error.code !== '23505') unwrap({ data: null, error });

  const { data: idsData, error: idsError } = await supabase
    .from('saved_videos')
    .select('video_id')
    .eq('user_id', user.id);
  const ids = unwrap({ data: idsData, error: idsError }) ?? [];

  return json({ saved: true, ids: ids.map((entry) => entry.video_id) });
});

export const DELETE = route(async (req) => {
  const user = await requireUser();
  const { videoId } = await parseBody(req, deleteSchema);
  const supabase = await createClient();

  const { error } = await supabase
    .from('saved_videos')
    .delete()
    .eq('user_id', user.id)
    .eq('video_id', videoId);
  if (error) unwrap({ data: null, error });

  const { data: idsData, error: idsError } = await supabase
    .from('saved_videos')
    .select('video_id')
    .eq('user_id', user.id);
  const ids = unwrap({ data: idsData, error: idsError }) ?? [];

  return json({ saved: false, ids: ids.map((entry) => entry.video_id) });
});
