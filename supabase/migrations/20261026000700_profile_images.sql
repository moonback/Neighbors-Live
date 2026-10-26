-- Public profile images are kept separately from private video media.
alter table public.profiles
  add column avatar_path text,
  add column cover_path text;

grant select (avatar_path, cover_path) on public.profiles to anon, authenticated;
grant update (avatar_path, cover_path) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images',
  'profile-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy profile_images_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'profile-images');

create policy profile_images_upload_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy profile_images_delete_own on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
