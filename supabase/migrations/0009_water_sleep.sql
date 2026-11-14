-- Phase 6: water and sleep.
--
-- water_logs: one row per drink, always stored in ounces.
-- sleep_logs: one row per night, filed under the day the person woke up. The pair
--   (user_id, slept_on) is the key, so two phones cannot create two entries for one night.

create table public.water_logs (
  id         uuid primary key,
  user_id    uuid not null references auth.users on delete cascade,
  logged_on  date not null,
  amount_oz  numeric not null check (amount_oz > 0),
  logged_at  timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at  timestamptz not null default now()
);

create table public.sleep_logs (
  user_id    uuid not null references auth.users on delete cascade,
  slept_on   date not null,
  bed_time   time,
  wake_time  time,
  hours      numeric check (hours >= 0 and hours <= 24),
  quality    int check (quality between 1 and 5),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at  timestamptz not null default now(),
  primary key (user_id, slept_on)
);

do $$
declare
  t text;
begin
  foreach t in array array['water_logs', 'sleep_logs']
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
