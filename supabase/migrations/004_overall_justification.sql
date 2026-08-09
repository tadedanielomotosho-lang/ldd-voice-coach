-- Justification text shown under the overall score on coaching reports.
alter table public.analyses
  add column if not exists overall_justification text;
