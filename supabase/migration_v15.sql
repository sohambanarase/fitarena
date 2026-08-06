-- ============================================================
-- FitArena — v15 migration  (water / hydration tracking)
-- Run in Supabase → SQL Editor after v1–v14. Additive; safe to re-run.
-- ============================================================

-- Every sip logged. Small rows, no images, same shape as the other trackers.
create table if not exists public.water_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  log_date   date not null default current_date,
  ml         int  not null,
  label      text,                       -- e.g. "My bottle" when logged from a preset
  created_at timestamptz not null default now()
);
create index if not exists water_logs_user_date_idx on public.water_logs (user_id, log_date);
alter table public.water_logs enable row level security;
drop policy if exists "water own" on public.water_logs;
create policy "water own" on public.water_logs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Hydration settings live next to the other nutrition goals so they stay in one place.
alter table public.nutrition_goals add column if not exists water_goal_ml   int default 2500;
alter table public.nutrition_goals add column if not exists water_presets   jsonb;      -- [{label, ml}]
alter table public.nutrition_goals add column if not exists water_reminders boolean default false;
alter table public.nutrition_goals add column if not exists water_every_h   int default 2;   -- hours between nudges
alter table public.nutrition_goals add column if not exists water_from_h    int default 9;   -- local hour to start
alter table public.nutrition_goals add column if not exists water_to_h      int default 21;  -- local hour to stop
alter table public.nutrition_goals add column if not exists water_tz_min    int default 0;   -- minutes offset from UTC
alter table public.nutrition_goals add column if not exists water_last_ping timestamptz;

-- The reminder job reads these rows with the service key, so no extra policy is needed;
-- users still only see their own row through the existing "goals own" policy.
