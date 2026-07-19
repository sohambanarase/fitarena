-- ============================================================
-- FitArena — v12 migration  (calories burned / activity log)
-- Run in Supabase → SQL Editor after v1–v11. Additive; safe.
-- ============================================================

create table if not exists public.activity_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  log_date   date not null default current_date,
  label      text not null,
  calories   numeric not null,
  minutes    numeric,
  source     text default 'manual',      -- manual | ai | workout
  created_at timestamptz not null default now()
);
create index if not exists activity_logs_user_date_idx on public.activity_logs (user_id, log_date);
alter table public.activity_logs enable row level security;
drop policy if exists "activity own" on public.activity_logs;
create policy "activity own" on public.activity_logs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
