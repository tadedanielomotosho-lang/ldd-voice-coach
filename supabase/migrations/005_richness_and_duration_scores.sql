-- Content richness + speaking-duration dimensions (each pillar still totals 100).
alter table public.analyses
  add column if not exists richness_score numeric(5,2) default 0,
  add column if not exists richness_feedback text,
  add column if not exists duration_score numeric(5,2) default 0,
  add column if not exists duration_feedback text;
