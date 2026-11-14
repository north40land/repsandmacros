-- Phase 3b: target calculator and weekly adherence.
--
-- user_profile_metrics holds what the calculator needs, one row per person. Beyond the
-- spec it also keeps: the rest-day split, any numbers the person overrode by hand,
-- whether targets should follow new weigh-ins, and the adherence tolerances.
--
-- body_metrics is the Phase 5 table, created now so the calculator has somewhere to
-- record weight. Phase 5 adds the screens for it.

create table public.user_profile_metrics (
  user_id                     uuid primary key references auth.users on delete cascade,
  sex                         text check (sex in ('male', 'female')),
  birth_date                  date,
  height_cm                   numeric check (height_cm > 0),
  activity_level              text check (activity_level in ('sedentary', 'light', 'moderate', 'very', 'extreme')),
  goal_type                   text check (goal_type in ('cut', 'maintain', 'build')),
  goal_adjustment_kcal        numeric check (goal_adjustment_kcal >= 0),
  macro_mode                  text check (macro_mode in ('percent', 'protein_first')),
  protein_pct                 numeric,
  carb_pct                    numeric,
  fat_pct                     numeric,
  protein_g_per_lb            numeric,
  fat_pct_of_calories         numeric,
  separate_training_day_split boolean not null default false,
  rest_split                  jsonb,
  overrides                   jsonb,
  auto                        boolean not null default true,
  tol_calories_pct            numeric not null default 5 check (tol_calories_pct >= 0),
  tol_protein_g               numeric not null default 10 check (tol_protein_g >= 0),
  updated_at                  timestamptz not null default now(),
  deleted_at                  timestamptz,
  synced_at                   timestamptz not null default now()
);

create table public.body_metrics (
  id           uuid primary key,
  user_id      uuid not null references auth.users on delete cascade,
  measured_on  date not null,
  weight       numeric check (weight > 0),
  unit         text not null default 'lb' check (unit in ('lb', 'kg')),
  body_fat     numeric check (body_fat >= 0 and body_fat <= 100),
  measurements jsonb,
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  synced_at    timestamptz not null default now()
);

do $$
declare
  t text;
begin
  foreach t in array array['user_profile_metrics', 'body_metrics']
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
