-- =============================================
-- LDD Voice Coach — Row Level Security
-- =============================================

-- PROFILES
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- STUDENTS
alter table public.students enable row level security;

create policy "Coaches can view own students"
  on public.students for select
  using (tutor_id = auth.uid());

create policy "Coaches can create students"
  on public.students for insert
  with check (tutor_id = auth.uid());

create policy "Coaches can update own students"
  on public.students for update
  using (tutor_id = auth.uid())
  with check (tutor_id = auth.uid());

create policy "Coaches can delete own students"
  on public.students for delete
  using (tutor_id = auth.uid());

-- SESSIONS
alter table public.sessions enable row level security;

create policy "Coaches can view own sessions"
  on public.sessions for select
  using (tutor_id = auth.uid());

create policy "Coaches can create sessions"
  on public.sessions for insert
  with check (tutor_id = auth.uid());

create policy "Coaches can update own sessions"
  on public.sessions for update
  using (tutor_id = auth.uid())
  with check (tutor_id = auth.uid());

create policy "Coaches can delete own sessions"
  on public.sessions for delete
  using (tutor_id = auth.uid());

-- ANALYSIS JOBS — read-only for coaches, write via service role
alter table public.analysis_jobs enable row level security;

create policy "Coaches can view own jobs"
  on public.analysis_jobs for select
  using (
    session_id in (
      select id from public.sessions where tutor_id = auth.uid()
    )
  );

-- ANALYSES — read-only for coaches, write via service role
alter table public.analyses enable row level security;

create policy "Coaches can view own analyses"
  on public.analyses for select
  using (tutor_id = auth.uid());
