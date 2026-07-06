-- ============================================================
-- FitArena — v8 migration  (custom exercises)
-- Run in Supabase → SQL Editor after v1–v7. Additive; data is safe.
-- ============================================================

-- Exercises a user adds themselves (not in the public dataset). Private per user.
-- `muscle` is optional — if set, the exercise shows under that body-part tile.
create table if not exists public.custom_exercises (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  muscle     text,
  created_at timestamptz not null default now()
);
create index if not exists custom_ex_user_idx on public.custom_exercises (user_id, created_at asc);
alter table public.custom_exercises enable row level security;
drop policy if exists "custom ex own" on public.custom_exercises;
create policy "custom ex own" on public.custom_exercises for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
