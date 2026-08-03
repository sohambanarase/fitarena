-- ============================================================
-- FitArena — Supabase schema
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run (drops + recreates policies).
-- ============================================================

-- ---------- TABLES ----------

-- One row per user, created automatically on sign-up (see trigger below).
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  name            text,
  height_cm       numeric,
  start_weight_kg numeric,           -- locked-in starting metric for the challenge
  current_weight_kg numeric,         -- updated over time
  goal            text,              -- free text e.g. "Lose 5kg" / "Recomp" / "Get to 4 gym days"
  weekly_goal     int  not null default 4,  -- gym sessions/week that = 100% consistency
  created_at      timestamptz not null default now()
);

-- A challenge groups friends together. Friends join with the invite_code (no email service needed → stays $0).
create table if not exists public.challenges (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Summer Cut',
  invite_code text not null unique default upper(substr(md5(random()::text), 1, 6)), -- e.g. "A1F4C9"
  start_date  date not null default current_date,
  end_date    date not null default (current_date + 30),
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- Junction: who is in which challenge.
create table if not exists public.challenge_members (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

-- One row per check-in. UNIQUE(user_id, log_date) lets us UPSERT a day's status.
-- workout_type: 'lift' | 'cardio' = hit the gym; 'rest' = planned recovery (keeps streak); 'skip' = missed (breaks streak)
create table if not exists public.daily_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  log_date     date not null default current_date,
  workout_type text not null check (workout_type in ('lift','cardio','rest','skip')),
  -- completed_gym is derived so the rest of the app never has to re-derive it:
  completed_gym boolean generated always as (workout_type in ('lift','cardio')) stored,
  note         text,
  created_at   timestamptz not null default now(),
  unique (user_id, log_date)
);

create index if not exists daily_logs_user_date_idx on public.daily_logs (user_id, log_date desc);
create index if not exists challenge_members_user_idx on public.challenge_members (user_id);

-- ---------- RECURSION-SAFE MEMBERSHIP HELPER ----------
-- RLS policies that query challenge_members FROM WITHIN a challenge_members policy cause
-- "infinite recursion detected in policy". The standard fix is a SECURITY DEFINER function
-- that bypasses RLS for the lookup. Every "can I see this person?" check routes through here.
create or replace function public.shares_challenge_with(target uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from challenge_members me
    join challenge_members them
      on them.challenge_id = me.challenge_id
    where me.user_id = auth.uid()
      and them.user_id = target
  );
$$;

create or replace function public.is_challenge_member(c_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from challenge_members
    where challenge_id = c_id and user_id = auth.uid()
  );
$$;

-- ---------- ROW LEVEL SECURITY ----------
alter table public.profiles          enable row level security;
alter table public.challenges        enable row level security;
alter table public.challenge_members enable row level security;
alter table public.daily_logs        enable row level security;

-- profiles: read yourself + anyone you share a challenge with; write only yourself.
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select
  using (id = auth.uid() or public.shares_challenge_with(id));

drop policy if exists "profiles upsert self" on public.profiles;
create policy "profiles upsert self" on public.profiles for insert
  with check (id = auth.uid());

drop policy if exists "profiles update self" on public.profiles;
create policy "profiles update self" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- challenges: read challenges you belong to (or that you created); create freely; only owner edits.
-- NOTE: we also allow reading a challenge row when you know its invite_code — handled by the
-- join RPC below rather than a broad SELECT policy, to avoid leaking the member list.
drop policy if exists "challenges read mine" on public.challenges;
create policy "challenges read mine" on public.challenges for select
  using (created_by = auth.uid() or public.is_challenge_member(id));

drop policy if exists "challenges insert" on public.challenges;
create policy "challenges insert" on public.challenges for insert
  with check (created_by = auth.uid());

drop policy if exists "challenges update owner" on public.challenges;
create policy "challenges update owner" on public.challenges for update
  using (created_by = auth.uid()) with check (created_by = auth.uid());

-- challenge_members: read rows for challenges you're in; insert only yourself; leave (delete) yourself.
drop policy if exists "members read" on public.challenge_members;
create policy "members read" on public.challenge_members for select
  using (public.is_challenge_member(challenge_id));

drop policy if exists "members join self" on public.challenge_members;
create policy "members join self" on public.challenge_members for insert
  with check (user_id = auth.uid());

drop policy if exists "members leave self" on public.challenge_members;
create policy "members leave self" on public.challenge_members for delete
  using (user_id = auth.uid());

-- daily_logs: read your own + your group's; write only your own.
drop policy if exists "logs read group" on public.daily_logs;
create policy "logs read group" on public.daily_logs for select
  using (user_id = auth.uid() or public.shares_challenge_with(user_id));

drop policy if exists "logs write self" on public.daily_logs;
create policy "logs write self" on public.daily_logs for insert
  with check (user_id = auth.uid());

drop policy if exists "logs update self" on public.daily_logs;
create policy "logs update self" on public.daily_logs for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- JOIN-BY-CODE RPC ----------
-- Lets a user join a challenge by invite_code without being able to SELECT challenges
-- they aren't in yet. Returns the challenge id.
create or replace function public.join_challenge(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare c_id uuid;
begin
  select id into c_id from challenges where invite_code = upper(code);
  if c_id is null then
    raise exception 'No challenge found for code %', code;
  end if;
  insert into challenge_members (challenge_id, user_id)
  values (c_id, auth.uid())
  on conflict do nothing;
  return c_id;
end;
$$;

-- ---------- AUTO-CREATE PROFILE ON SIGN-UP ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
