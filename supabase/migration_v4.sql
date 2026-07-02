-- ============================================================
-- FitArena — v4 migration
-- Run in Supabase → SQL Editor after v1, v2, v3. Additive; data is safe.
-- ============================================================

-- Goals can be tied to an exercise and auto-tracked from your workout log.
alter table public.goals add column if not exists exercise text;
alter table public.goals add column if not exists metric text default 'weight'; -- 'weight' (best logged kg)

-- Workout entries store per-set detail as JSON, one row per exercise per day.
-- Shape: [{ "weight": 80, "reps": 8 }, { "weight": 85, "reps": 6 }]
alter table public.workout_entries add column if not exists sets_detail jsonb not null default '[]'::jsonb;
