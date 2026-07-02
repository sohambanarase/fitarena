-- ============================================================
-- FitArena — v5 migration
-- Run in Supabase → SQL Editor after v1–v4. Additive; data is safe.
-- ============================================================

-- Reusable workout templates (Push Day, Leg Day, etc.). Private per user.
-- exercises shape: [{ "exercise": "Bench Press", "sets": 3, "reps": 8, "weight": 80 }]
create table if not exists public.workout_plans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  exercises  jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists workout_plans_user_idx on public.workout_plans (user_id, created_at asc);
alter table public.workout_plans enable row level security;
drop policy if exists "plans own" on public.workout_plans;
create policy "plans own" on public.workout_plans for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
