-- =============================================
-- LDD Voice Coach — Storage + Job Queue
-- =============================================

-- Storage bucket for audio files
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'audio',
  'audio',
  false,
  26214400, -- 25MB in bytes
  array['audio/webm','audio/webm;codecs=opus','audio/mp4','audio/mpeg','audio/ogg','audio/wav','audio/x-m4a','audio/aac']
)
on conflict (id) do nothing;

-- Storage RLS: coaches can only access their own folder
create policy "Coaches can upload own audio"
  on storage.objects for insert
  with check (
    bucket_id = 'audio' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Coaches can read own audio"
  on storage.objects for select
  using (
    bucket_id = 'audio' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Coaches can delete own audio"
  on storage.objects for delete
  using (
    bucket_id = 'audio' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================
-- Job queue processor via pg_cron
-- Polls every 10 seconds and invokes Edge Function
-- =============================================
select cron.schedule(
  'process-analysis-jobs',
  '10 seconds',
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/process-analysis',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
