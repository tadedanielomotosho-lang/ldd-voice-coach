-- =============================================
-- LDD Voice Coach — Initial Schema
-- =============================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";

-- =============================================
-- PROFILES (extends auth.users)
-- =============================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  email       text not null default '',
  role        text not null default 'coach' check (role in ('coach', 'admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================
-- STUDENTS
-- =============================================
create table if not exists public.students (
  id          uuid primary key default uuid_generate_v4(),
  tutor_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  email       text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_students_tutor_id on public.students(tutor_id);

-- =============================================
-- SESSIONS
-- =============================================
create table if not exists public.sessions (
  id                    uuid primary key default uuid_generate_v4(),
  tutor_id              uuid not null references public.profiles(id) on delete cascade,
  student_id            uuid references public.students(id) on delete set null,
  session_name          text not null,
  presentation_topic    text not null,
  audio_storage_path    text,
  audio_mime_type       text,
  audio_duration_seconds integer,
  status                text not null default 'pending'
                          check (status in ('pending','processing','done','error')),
  recorded_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_sessions_tutor_id   on public.sessions(tutor_id);
create index idx_sessions_student_id on public.sessions(student_id);
create index idx_sessions_status     on public.sessions(status);

-- =============================================
-- ANALYSIS JOBS (queue)
-- =============================================
create table if not exists public.analysis_jobs (
  id             uuid primary key default uuid_generate_v4(),
  session_id     uuid not null references public.sessions(id) on delete cascade,
  status         text not null default 'queued'
                   check (status in ('queued','processing','done','error')),
  error_message  text,
  attempt_count  integer not null default 0,
  queued_at      timestamptz not null default now(),
  started_at     timestamptz,
  completed_at   timestamptz
);

create index idx_jobs_status     on public.analysis_jobs(status);
create index idx_jobs_session_id on public.analysis_jobs(session_id);

-- =============================================
-- ANALYSES (results)
-- =============================================
create table if not exists public.analyses (
  id                    uuid primary key default uuid_generate_v4(),
  session_id            uuid not null references public.sessions(id) on delete cascade,
  student_id            uuid references public.students(id) on delete set null,
  tutor_id              uuid not null references public.profiles(id) on delete cascade,
  transcript            text,
  word_count            integer default 0,
  -- Content scores (total 100)
  content_score         numeric(5,2) default 0,
  hook_score            numeric(5,2) default 0,  -- /20
  purpose_score         numeric(5,2) default 0,  -- /15
  key_points_score      numeric(5,2) default 0,  -- /30
  cta_score             numeric(5,2) default 0,  -- /15
  clarity_score         numeric(5,2) default 0,  -- /20
  -- Delivery scores (total 100)
  delivery_score        numeric(5,2) default 0,
  tone_score            numeric(5,2) default 0,  -- /25
  pace_score            numeric(5,2) default 0,  -- /25
  pause_score           numeric(5,2) default 0,  -- /25
  volume_score          numeric(5,2) default 0,  -- /25
  -- Overall
  overall_score         numeric(5,2) default 0,
  -- Feedback text
  hook_feedback         text,
  purpose_feedback      text,
  key_points_feedback   text,
  cta_feedback          text,
  clarity_feedback      text,
  tone_feedback         text,
  pace_feedback         text,
  pause_feedback        text,
  volume_feedback       text,
  -- Structured coaching output
  transcript_coaching   jsonb default '[]',
  -- Raw AI response (for debugging)
  raw_ai_response       jsonb,
  created_at            timestamptz not null default now()
);

create index idx_analyses_session_id  on public.analyses(session_id);
create index idx_analyses_student_id  on public.analyses(student_id);
create index idx_analyses_tutor_id    on public.analyses(tutor_id);
