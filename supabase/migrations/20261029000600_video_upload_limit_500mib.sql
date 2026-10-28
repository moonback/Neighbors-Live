-- Keep both private video buckets aligned with the application upload limit.
update storage.buckets
set file_size_limit = 524288000
where id in ('raw-videos', 'videos');
