-- Neighbors Live — storage buckets, storage policies and scheduled jobs.

-- Both buckets are private. Reads go through short-lived signed URLs created server-side.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('raw-videos', 'raw-videos', false, 62914560, array['video/mp4', 'video/webm']),
  ('videos', 'videos', false, 62914560, array['video/mp4', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Authors upload their single raw recording; nobody (but service_role) can read raw files.
create policy raw_videos_upload_own on storage.objects for insert to authenticated
  with check (bucket_id = 'raw-videos' and public.can_upload_raw(name));

-- TUS resumable uploads may update the object they are writing.
create policy raw_videos_update_own on storage.objects for update to authenticated
  using (bucket_id = 'raw-videos' and public.can_upload_raw(name))
  with check (bucket_id = 'raw-videos' and public.can_upload_raw(name));

-- Expire videos every 5 minutes.
select cron.schedule('expire-videos', '*/5 * * * *', $$select public.expire_videos()$$);
