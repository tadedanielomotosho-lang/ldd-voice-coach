-- Parallel workers used to insert two analyses for one session.
-- The report query then failed and the page waited forever.
delete from public.analyses a
using public.analyses b
where a.session_id = b.session_id
  and (
    a.created_at < b.created_at
    or (a.created_at = b.created_at and a.id::text < b.id::text)
  );

create unique index if not exists analyses_session_id_key
  on public.analyses (session_id);

delete from public.analysis_jobs a
using public.analysis_jobs b
where a.session_id = b.session_id
  and (
    a.queued_at < b.queued_at
    or (a.queued_at = b.queued_at and a.id::text < b.id::text)
  );

create unique index if not exists analysis_jobs_session_id_key
  on public.analysis_jobs (session_id);
