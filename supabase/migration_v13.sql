-- ============================================================
-- FitArena — v13 migration  (maintenance calories alongside the goal)
-- Run in Supabase → SQL Editor after v1–v12. Additive; safe.
-- ============================================================

alter table public.nutrition_goals add column if not exists maintenance_calories int;
