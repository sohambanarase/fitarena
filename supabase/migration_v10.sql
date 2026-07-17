-- ============================================================
-- FitArena — v10 migration  (logged workout session time)
-- Run in Supabase → SQL Editor after v1–v9. Additive; safe.
-- ============================================================

create table if not exists public.workout_sessions (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  log_date  date not null default current_date,
  seconds   int not null,
  ended_at  timestamptz not null default now()
);
create index if not exists workout_sessions_user_idx on public.workout_sessions (user_id, log_date);
alter table public.workout_sessions enable row level security;
drop policy if exists "sessions own" on public.workout_sessions;
create policy "sessions own" on public.workout_sessions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
