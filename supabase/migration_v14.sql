-- ============================================================
-- FitArena — v14 migration
--   1. challenges: dynamic end dates + lifecycle (active / completed)
--   2. global_scores: permanent cross-user score + nickname for the global leaderboard
-- Run in Supabase → SQL Editor after v1–v13. Additive; safe to re-run.
-- ============================================================

-- ---------- 1. challenges ----------
-- New challenges default to 30 days out instead of a fixed calendar date.
alter table public.challenges alter column end_date set default (current_date + 30);

alter table public.challenges add column if not exists status text not null default 'active';
alter table public.challenges add column if not exists completed_at timestamptz;

-- Existing challenges are deliberately left alone. Once one passes its end date the
-- app shows a banner asking whether to extend it (pick a new date) or complete it,
-- so nobody has their dates changed behind their back.

-- ---------- 2. permanent global score ----------
create table if not exists public.global_scores (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  nickname       text,
  points         int not null default 0,
  current_streak int not null default 0,
  best_streak    int not null default 0,
  active_days    int not null default 0,
  updated_at     timestamptz not null default now()
);

-- one nickname per person, case-insensitive
create unique index if not exists global_scores_nickname_key
  on public.global_scores (lower(nickname)) where nickname is not null;

alter table public.global_scores enable row level security;

-- everyone signed in can read the board (that's the point of a global leaderboard)
drop policy if exists "global scores readable" on public.global_scores;
create policy "global scores readable" on public.global_scores
  for select using (auth.uid() is not null);

-- but you may only write your own row
drop policy if exists "own global score insert" on public.global_scores;
create policy "own global score insert" on public.global_scores
  for insert with check (user_id = auth.uid());

drop policy if exists "own global score update" on public.global_scores;
create policy "own global score update" on public.global_scores
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
