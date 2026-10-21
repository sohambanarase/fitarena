-- ============================================================
-- FitArena — v16 migration  (explicit Data API grants)
-- Run in Supabase → SQL Editor after v1–v15. Safe to re-run.
-- ============================================================
--
-- From 30 Oct 2026 Supabase stops auto-granting Data API access to new tables in
-- "public". Tables created after that date return "permission denied" to supabase-js
-- until they're granted explicitly. That hits any fresh setup from this repo: a new
-- project, a preview branch, or a local `supabase db reset`.
--
-- Existing projects keep their current grants, so running this on the live project
-- changes nothing in practice. It just makes the repo self-sufficient.
--
-- Grants are the outer gate; Row-Level Security is still what scopes rows. Every table
-- below has RLS on and every policy requires a signed-in user, so `anon` can see table
-- shapes but never rows.
--
-- Adding a table later? Add it to this list, or grant it in its own migration.

grant usage on schema public to anon, authenticated, service_role;

do $$
declare
  t text;
  tables text[] := array[
    'profiles', 'challenges', 'challenge_members', 'daily_logs',
    'achievements', 'activity_logs', 'custom_exercises', 'goals',
    'workout_plans', 'workout_sessions', 'workout_entries',
    'foods', 'food_logs', 'favorite_foods', 'saved_meals', 'saved_meal_items',
    'nutrition_goals', 'water_logs',
    'global_scores', 'push_subscriptions', 'notify_state'
  ];
begin
  foreach t in array tables loop
    -- skip quietly if an older setup never created this table
    if to_regclass('public.' || t) is null then
      raise notice 'skipping %, table not found', t;
      continue;
    end if;
    execute format('grant select on public.%I to anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;
