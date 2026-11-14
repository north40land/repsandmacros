-- Foundation + Phase 1: per-user accounts, the hypertrophy program, free-form workouts, saved presets.
-- Run once in the SQL editor of a new Supabase project.
--
-- Conventions used by every table (the app's sync layer relies on them):
--   user_id     owner; Row Level Security limits every read and write to auth.uid()
--   updated_at  set by the phone that made the change
--   deleted_at  soft delete, so other devices learn about removals
--   synced_at   set by the server on every write; phones pull "everything newer than X"

create or replace function public.touch_synced_at()
returns trigger language plpgsql as $$
begin
  new.synced_at = clock_timestamp();
  return new;
end
$$;

create table public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  display_name  text not null default '',
  default_unit  text not null default 'lb' check (default_unit in ('lb', 'kg')),
  rest_seconds  int  not null default 60 check (rest_seconds between 0 and 600),
  program_block int  not null default 1 check (program_block >= 1),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  synced_at     timestamptz not null default now()
);

create table public.user_presets (
  id         uuid primary key,
  user_id    uuid not null references auth.users on delete cascade,
  name       text not null,
  body_parts text[] not null default '{}',
  exercises  jsonb not null default '[]',  -- [{ name, sets: [{ reps, weight, unit }] }]
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at  timestamptz not null default now()
);

create table public.workouts (
  id            uuid primary key,
  user_id       uuid not null references auth.users on delete cascade,
  name          text not null,
  performed_at  timestamptz not null,
  body_parts    text[] not null default '{}',
  source        text not null check (source in ('program', 'preset', 'custom')),
  preset_id     uuid,
  notes         text,
  program_block int,
  program_week  int check (program_week between 1 and 4),
  finished_at   timestamptz,
  extras        jsonb,                      -- program days: cardio and Queenax ticks
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  synced_at     timestamptz not null default now()
);

create table public.workout_exercises (
  id           uuid primary key,
  user_id      uuid not null references auth.users on delete cascade,
  workout_id   uuid not null references public.workouts on delete cascade,
  name         text not null,
  order_index  int  not null default 0,
  exercise_key text,                        -- set for program lifts, links to one_rep_maxes
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  synced_at    timestamptz not null default now()
);

create table public.workout_sets (
  id          uuid primary key,
  user_id     uuid not null references auth.users on delete cascade,
  exercise_id uuid not null references public.workout_exercises on delete cascade,
  set_number  int  not null,
  reps        int  check (reps > 0),
  weight      numeric check (weight >= 0),
  unit        text not null default 'lb' check (unit in ('lb', 'kg')),
  rpe         numeric check (rpe between 1 and 10),
  notes       text,
  done        boolean not null default false,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  synced_at   timestamptz not null default now()
);

create table public.one_rep_maxes (
  user_id      uuid not null references auth.users on delete cascade,
  exercise_key text not null,
  value        numeric check (value > 0),
  estimated    boolean not null default false,
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  synced_at    timestamptz not null default now(),
  primary key (user_id, exercise_key)
);

-- Row Level Security, sync trigger, pull index and grants for every table.
do $$
declare
  t text;
  owner_col text;
begin
  foreach t in array array['profiles', 'user_presets', 'workouts', 'workout_exercises', 'workout_sets', 'one_rep_maxes']
  loop
    owner_col := case when t = 'profiles' then 'id' else 'user_id' end;
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated using (%I = (select auth.uid())) with check (%I = (select auth.uid()))',
      t, owner_col, owner_col);
    execute format(
      'create trigger touch_synced_at before insert or update on public.%I for each row execute function public.touch_synced_at()', t);
    execute format('create index %I on public.%I (%I, synced_at)', t || '_sync_idx', t, owner_col);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
end
$$;
