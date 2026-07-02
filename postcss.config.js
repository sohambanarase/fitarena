-- ============================================================
-- FitArena — v6 migration
-- Run in Supabase → SQL Editor after v1–v5. Additive; data is safe.
-- ============================================================

-- Let the challenge CREATOR remove another member. Runs with definer rights so it
-- can delete a row that isn't the caller's own membership, but only after checking
-- the caller actually created the challenge.
create or replace function public.remove_member(c_id uuid, target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from challenges where id = c_id and created_by = auth.uid()) then
    raise exception 'Only the challenge creator can remove members';
  end if;
  if target = auth.uid() then
    raise exception 'Use "leave" to remove yourself';
  end if;
  delete from challenge_members where challenge_id = c_id and user_id = target;
end;
$$;
