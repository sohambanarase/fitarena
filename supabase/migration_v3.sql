-- ============================================================
-- FitArena — v3 migration
-- Run in Supabase → SQL Editor after schema.sql and migration_v2.sql.
-- Additive only; existing data is safe.
-- ============================================================

-- 1) Wins belong to a specific challenge, so each feed is exclusive.
alter table public.achievements add column if not exists challenge_id uuid references public.challenges(id) on delete cascade;
create index if not exists achievements_challenge_idx on public.achievements (challenge_id, created_at desc);

-- 2) Personal goals (private to each user) — the Grind tab.
create table if not exists public.goals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  target     numeric,
  current    numeric not null default 0,
  unit       text,
  created_at timestamptz not null default now()
);
create index if not exists goals_user_idx on public.goals (user_id, created_at desc);
alter table public.goals enable row level security;
drop policy if exists "goals own" on public.goals;
create policy "goals own" on public.goals for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3) Daily workout log (private) — quick set-by-set entries.
create table if not exists public.workout_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  log_date   date not null default current_date,
  exercise   text not null,
  sets       int,
  reps       int,
  weight_kg  numeric,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists workout_entries_user_idx on public.workout_entries (user_id, log_date desc);
alter table public.workout_entries enable row level security;
drop policy if exists "entries own" on public.workout_entries;
create policy "entries own" on public.workout_entries for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
