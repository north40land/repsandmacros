-- Phase 4: scheduled dosing log.
--
-- dose_items: what a person takes, how much, and on which weekdays (0 = Sunday .. 6 = Saturday).
--   starts_on       the first day it counts from
--   missed_through  the last day already checked for missed doses
-- dose_logs: one entry per item per day: taken, skipped or missed. The pair
--   (dose_item_id, scheduled_on) is the key, so two phones can never create two
--   entries for the same day.

create table public.dose_items (
  id             uuid primary key,
  user_id        uuid not null references auth.users on delete cascade,
  name           text not null,
  amount         numeric not null check (amount > 0),
  unit           text not null,
  schedule_days  int[] not null default '{}',
  time_of_day    time,
  notes          text,
  active         boolean not null default true,
  starts_on      date not null,
  missed_through date,
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  synced_at      timestamptz not null default now()
);

create table public.dose_logs (
  dose_item_id uuid not null references public.dose_items on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  scheduled_on date not null,
  taken_at     timestamptz,
  amount_taken numeric check (amount_taken >= 0),
  status       text not null check (status in ('taken', 'missed', 'skipped')),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  synced_at    timestamptz not null default now(),
  primary key (dose_item_id, scheduled_on)
);

do $$
declare
  t text;
begin
  foreach t in array array['dose_items', 'dose_logs']
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

-- A phone that has been offline may decide a dose was missed when another phone already
-- logged it. Never let an automatic "missed" replace a real entry.
create or replace function public.keep_logged_dose()
returns trigger language plpgsql as $$
begin
  if old.deleted_at is null and old.status in ('taken', 'skipped') and new.status = 'missed' then
    new.status := old.status;
    new.taken_at := old.taken_at;
    new.amount_taken := old.amount_taken;
    new.updated_at := old.updated_at;
    new.deleted_at := null;
  end if;
  return new;
end
$$;

create trigger keep_logged_dose before update on public.dose_logs
  for each row execute function public.keep_logged_dose();
