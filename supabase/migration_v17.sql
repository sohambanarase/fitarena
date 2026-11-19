-- ============================================================
-- FitArena — v17 migration  (Global Board: tap a name to see how they scored)
-- Run in Supabase → SQL Editor after v1–v16. Safe to re-run.
-- ============================================================
--
-- The Global Board shows people from every challenge, but check-ins are normally only
-- readable by people who share a challenge. This function lets any signed-in user read
-- the bare scoring history of someone who has joined the board (set a nickname), so the
-- app can recalculate their points on the viewer's own phone, with the same rules for all.
--
-- It returns only what the score is built from:
--   check-ins  -> date + type (lift / cardio / rest)
--   wins       -> date + kind (pr / brag)
--   weekly goal
-- No notes, PR text, photos, food, water, weight or anything else.

create or replace function public.board_history(target uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select case
    when auth.uid() is null then null
    -- only people who are on the board (or yourself)
    when target <> auth.uid() and not exists (
      select 1 from public.global_scores g where g.user_id = target and g.nickname is not null
    ) then null
    else jsonb_build_object(
      'weekly_goal', coalesce((select p.weekly_goal from public.profiles p where p.id = target), 4),
      'logs', coalesce((
        select jsonb_agg(jsonb_build_object('log_date', d.log_date, 'workout_type', d.workout_type) order by d.log_date)
        from public.daily_logs d where d.user_id = target
      ), '[]'::jsonb),
      'wins', coalesce((
        select jsonb_agg(jsonb_build_object('kind', a.kind, 'log_date', a.log_date) order by a.log_date)
        from public.achievements a where a.user_id = target
      ), '[]'::jsonb)
    )
  end
$$;

revoke all on function public.board_history(uuid) from public, anon;
grant execute on function public.board_history(uuid) to authenticated;
