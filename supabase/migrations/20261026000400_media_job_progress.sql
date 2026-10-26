alter table public.media_jobs
  add column progress integer not null default 0 check (progress between 0 and 100),
  add column phase text not null default 'queued';

create or replace function public.complete_process_job(p_job bigint, p_video_path text, p_poster_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_video uuid;
begin
  update public.media_jobs
  set status = 'done', progress = 100, phase = 'done', updated_at = now(), last_error = null
  where id = p_job and kind = 'process' returning video_id into v_video;
  if not found then raise exception 'job_not_found'; end if;
  update public.videos
  set video_path = p_video_path, poster_path = p_poster_path, raw_path = null,
      status = 'active', published_at = now()
  where id = v_video and status = 'processing';
end
$$;
