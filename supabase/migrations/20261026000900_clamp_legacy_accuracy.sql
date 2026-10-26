-- Videos inserted while the 500 m accuracy window (migration 000300) was active
-- and still in 'processing' status will violate videos_accuracy_m_check (≤ 100 m,
-- currently NOT VALID) the moment the worker UPDATEs them via complete_process_job.
-- Clamp those rows to 100 m so the worker can publish them normally, then validate
-- the constraint so it applies to all rows going forward without NOT VALID overhead.

update public.videos
set accuracy_m = 100
where accuracy_m > 100;

alter table public.videos
  validate constraint videos_accuracy_m_check;
