-- Phase 3: nutrition log. Foods a person has used or created, what they ate each day,
-- and their daily targets. Same conventions as 0001 (owner column, soft delete, synced_at).
--
-- Differences from the written spec, on purpose:
--   * foods.user_id is never null. Public USDA results live in food_cache (server only);
--     a food is copied into a person's own `foods` the first time they log it, which is
--     what powers their recent and favorite lists and lets it work offline.
--   * user_targets already has effective_from and computed (Phase 3b), so target
--     history is kept from day one and no key change is needed later.

create table public.foods (
  id            uuid primary key,
  user_id       uuid not null references auth.users on delete cascade,
  source        text not null check (source in ('usda', 'off', 'custom', 'recipe')),
  external_id   text,
  name          text not null,
  brand         text,
  serving_size  numeric not null check (serving_size > 0),   -- the amount the macros below are for
  serving_unit  text not null,                               -- 'g' for database foods, free text for custom
  portion_g     numeric check (portion_g > 0),               -- grams in one household serving, when known
  portion_label text,
  calories      numeric not null default 0 check (calories >= 0),
  protein       numeric not null default 0 check (protein >= 0),
  carbs         numeric not null default 0 check (carbs >= 0),
  fat           numeric not null default 0 check (fat >= 0),
  fiber         numeric not null default 0 check (fiber >= 0),
  favorite      boolean not null default false,
  last_used_at  timestamptz,
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  synced_at     timestamptz not null default now()
);

create table public.food_logs (
  id         uuid primary key,
  user_id    uuid not null references auth.users on delete cascade,
  logged_on  date not null,
  meal       text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snacks')),
  food_id    uuid,
  name       text not null,           -- copied from the food, so later edits do not rewrite history
  brand      text,
  quantity   numeric not null check (quantity > 0),
  unit       text not null,
  calories   numeric not null default 0 check (calories >= 0),
  protein    numeric not null default 0 check (protein >= 0),
  carbs      numeric not null default 0 check (carbs >= 0),
  fat        numeric not null default 0 check (fat >= 0),
  fiber      numeric not null default 0 check (fiber >= 0),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at  timestamptz not null default now()
);

create table public.user_targets (
  id             uuid primary key,
  user_id        uuid not null references auth.users on delete cascade,
  day_type       text not null check (day_type in ('training', 'rest')),
  effective_from date not null,
  computed       boolean not null default false,
  calories       numeric check (calories >= 0),
  protein        numeric check (protein >= 0),
  carbs          numeric check (carbs >= 0),
  fat            numeric check (fat >= 0),
  water_oz       numeric check (water_oz >= 0),
  sleep_hours    numeric check (sleep_hours >= 0),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  synced_at      timestamptz not null default now()
);

do $$
declare
  t text;
begin
  foreach t in array array['foods', 'food_logs', 'user_targets']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format(
      'create trigger touch_synced_at before insert or update on public.%I for each row execute function public.touch_synced_at()', t);
    execute format('create index %I on public.%I (user_id, synced_at)', t || '_sync_idx', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
end
$$;

-- Saved answers from the public food databases, to cut repeat calls.
-- Only the edge functions (service role) read and write it.
create table public.food_cache (
  key        text primary key,
  payload    jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.food_cache enable row level security;
revoke all on public.food_cache from anon, authenticated;
