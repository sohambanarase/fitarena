-- ============================================================
-- FitArena — v11 migration  (Count: nutrition tracking)
-- Run in Supabase → SQL Editor after v1–v10. Additive; safe.
-- No image blobs are stored — only text/number data (image_url is a URL string).
-- ============================================================

-- Daily goals (one row per user)
create table if not exists public.nutrition_goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users(id) on delete cascade,
  calories_goal int,
  protein_goal  int,
  carbs_goal    int,
  fat_goal      int,
  goal_type     text default 'maintain',   -- lose | maintain | gain
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.nutrition_goals enable row level security;
drop policy if exists "goals own" on public.nutrition_goals;
create policy "goals own" on public.nutrition_goals for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Foods. user_id null = public (e.g. Open Food Facts cache), else a user's custom food.
create table if not exists public.foods (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade,
  source            text default 'custom',   -- custom | off | ai | quickadd
  barcode           text,
  name              text not null,
  brand             text,
  image_url         text,
  calories_per_100g numeric,
  protein_per_100g  numeric,
  carbs_per_100g    numeric,
  fat_per_100g      numeric,
  sugar_per_100g    numeric,
  salt_per_100g     numeric,
  fiber_per_100g    numeric,
  serving_size      numeric,
  serving_quantity  numeric,
  serving_unit      text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists foods_user_idx on public.foods (user_id);
create unique index if not exists foods_barcode_public on public.foods (barcode) where user_id is null and barcode is not null;
alter table public.foods enable row level security;
drop policy if exists "foods read" on public.foods;
create policy "foods read" on public.foods for select using (user_id = auth.uid() or user_id is null);
drop policy if exists "foods write own" on public.foods;
create policy "foods write own" on public.foods for insert with check (user_id = auth.uid() or user_id is null);
drop policy if exists "foods update own" on public.foods;
create policy "foods update own" on public.foods for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "foods delete own" on public.foods;
create policy "foods delete own" on public.foods for delete using (user_id = auth.uid());

-- A logged food for a day/meal, with the calculated (already-scaled) macros stored.
create table if not exists public.food_logs (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  food_id              uuid references public.foods(id) on delete set null,
  name                 text,   -- snapshot so deleting a food doesn't blank the diary
  log_date             date not null default current_date,
  meal_type            text not null default 'snacks',
  quantity             numeric not null default 100,
  quantity_unit        text not null default 'g',
  quantity_grams       numeric,
  calculated_calories  numeric,
  calculated_protein   numeric,
  calculated_carbs     numeric,
  calculated_fat       numeric,
  calculated_sugar     numeric,
  calculated_salt      numeric,
  calculated_fiber     numeric,
  created_at           timestamptz not null default now()
);
create index if not exists food_logs_user_date_idx on public.food_logs (user_id, log_date);
alter table public.food_logs enable row level security;
drop policy if exists "food_logs own" on public.food_logs;
create policy "food_logs own" on public.food_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Saved meals (templates)
create table if not exists public.saved_meals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  meal_name   text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.saved_meals enable row level security;
drop policy if exists "saved_meals own" on public.saved_meals;
create policy "saved_meals own" on public.saved_meals for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.saved_meal_items (
  id             uuid primary key default gen_random_uuid(),
  saved_meal_id  uuid not null references public.saved_meals(id) on delete cascade,
  food_id        uuid references public.foods(id) on delete set null,
  quantity       numeric,
  quantity_unit  text,
  quantity_grams numeric,
  created_at     timestamptz not null default now()
);
alter table public.saved_meal_items enable row level security;
drop policy if exists "saved_meal_items own" on public.saved_meal_items;
create policy "saved_meal_items own" on public.saved_meal_items for all
  using (exists (select 1 from public.saved_meals m where m.id = saved_meal_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.saved_meals m where m.id = saved_meal_id and m.user_id = auth.uid()));

create table if not exists public.favorite_foods (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  food_id    uuid not null references public.foods(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, food_id)
);
alter table public.favorite_foods enable row level security;
drop policy if exists "favorite_foods own" on public.favorite_foods;
create policy "favorite_foods own" on public.favorite_foods for all using (user_id = auth.uid()) with check (user_id = auth.uid());
