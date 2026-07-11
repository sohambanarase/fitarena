-- ============================================================
-- FitArena — v9 migration  (admin: delete challenge + delete feed posts)
-- Run in Supabase → SQL Editor after v1–v8. Additive; safe.
-- ============================================================

-- Challenge creator can delete the whole challenge.
-- Cascades to challenge_members and achievements (both ON DELETE CASCADE).
-- Personal daily check-ins (daily_logs) are per-user and are left untouched.
create or replace function public.delete_challenge(c_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from challenges where id = c_id and created_by = auth.uid()) then
    raise exception 'Only the challenge creator can delete this challenge';
  end if;
  delete from challenges where id = c_id;
end;
$$;

-- Delete a feed post (achievement). Allowed if you posted it, OR you created the challenge.
create or replace function public.delete_win(win_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_user uuid; v_chal uuid;
begin
  select user_id, challenge_id into v_user, v_chal from achievements where id = win_id;
  if v_user is null then return; end if;
  if v_user = auth.uid()
     or exists (select 1 from challenges where id = v_chal and created_by = auth.uid()) then
    delete from achievements where id = win_id;
  else
    raise exception 'Not allowed to delete this post';
  end if;
end;
$$;
