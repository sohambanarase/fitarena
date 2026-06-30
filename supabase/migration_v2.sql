-- ============================================================
-- FitArena — v2 migration
-- Run this in Supabase → SQL Editor AFTER schema.sql (the v1 one).
-- It only ADDS things, so your existing data is safe.
-- ============================================================

-- 1) Challenges get their own goal/description (end_date already exists).
alter table public.challenges add column if not exists goal text;

-- 2) Profiles support multiple goals (multi-select). Old single `goal` stays for back-compat.
alter table public.profiles add column if not exists goals text[] not null default '{}';

-- 3) Personal wins: brag posts + PR (personal record) log.
--    Global per user (you train once, it counts in every challenge you're in).
create table if not exists public.achievements (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('brag','pr')),
  text       text,             -- brag caption / PR note
  exercise   text,             -- PR only
  weight_kg  numeric,          -- PR only
  reps       int,              -- PR only
  photo_url  text,             -- brag only (optional)
  log_date   date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists achievements_user_idx on public.achievements (user_id, created_at desc);

alter table public.achievements enable row level security;

drop policy if exists "wins read group" on public.achievements;
create policy "wins read group" on public.achievements for select
  using (user_id = auth.uid() or public.shares_challenge_with(user_id));

drop policy if exists "wins write self" on public.achievements;
create policy "wins write self" on public.achievements for insert
  with check (user_id = auth.uid());

drop policy if exists "wins delete self" on public.achievements;
create policy "wins delete self" on public.achievements for delete
  using (user_id = auth.uid());

-- 4) Photo storage for brags (OPTIONAL — text brags work without it).
--    Creates a public bucket + policies so users can upload to their own folder.
insert into storage.buckets (id, name, public)
values ('wins', 'wins', true)
on conflict (id) do nothing;

drop policy if exists "wins upload own" on storage.objects;
create policy "wins upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'wins' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "wins public read" on storage.objects;
create policy "wins public read" on storage.objects for select
  using (bucket_id = 'wins');

drop policy if exists "wins delete own" on storage.objects;
create policy "wins delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'wins' and (storage.foldername(name))[1] = auth.uid()::text);
