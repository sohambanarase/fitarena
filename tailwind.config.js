-- ============================================================
-- FitArena — v7 migration  (push notifications)
-- Run in Supabase → SQL Editor after v1–v6. Additive; data is safe.
-- ============================================================

-- One row per device/browser a user has enabled notifications on.
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  endpoint     text not null unique,
  subscription jsonb not null,
  created_at   timestamptz not null default now()
);
create index if not exists push_subs_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "subs own" on public.push_subscriptions;
create policy "subs own" on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Bookkeeping for the sender (cursors + last-seen ranks). Single row, id = 1.
-- RLS is on with NO policies, so only the service-role key (used by the server
-- function) can read/write it — clients can't touch it.
create table if not exists public.notify_state (
  id         int primary key default 1,
  state      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint notify_state_singleton check (id = 1)
);
insert into public.notify_state (id, state) values (1, '{}'::jsonb) on conflict (id) do nothing;
alter table public.notify_state enable row level security;
