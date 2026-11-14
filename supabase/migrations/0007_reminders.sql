-- Dose reminders as phone notifications (Web Push).
--
--   push_subscriptions  one row per phone that switched reminders on (owned by the user)
--   push_config         server only: the notification signing keys and the schedule's secret
--   push_sent           server only: which reminders already went out, so none repeats
--   profiles            gains the daily reminder time for items without their own time,
--                       and whether to send one follow-up for anything still unlogged
--
-- A schedule calls the dose-reminders function every 5 minutes.

create extension if not exists pg_cron;
create extension if not exists pg_net;

alter table public.profiles
  add column if not exists reminder_time time not null default '08:00',
  add column if not exists reminder_followup boolean not null default true;

create table public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references auth.users on delete cascade,
  p256dh     text not null,
  auth       text not null,
  tz         text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "own rows" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table public.push_config (
  id          int primary key default 1 check (id = 1),
  vapid       jsonb,
  cron_secret text not null default (gen_random_uuid()::text || gen_random_uuid()::text)
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;
insert into public.push_config default values on conflict do nothing;

create table public.push_sent (
  dose_item_id uuid not null,
  scheduled_on date not null,
  kind         text not null check (kind in ('due', 'nudge')),
  user_id      uuid not null,
  sent_at      timestamptz not null default now(),
  primary key (dose_item_id, scheduled_on, kind)
);
alter table public.push_sent enable row level security;
revoke all on public.push_sent from anon, authenticated;

-- Every 5 minutes, ask the function to send whatever is due.
select cron.schedule(
  'dose-reminders',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := 'https://vfsnjcjqhdjyitnvczxy.supabase.co/functions/v1/dose-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select cron_secret from public.push_config where id = 1)
    ),
    body := '{"action":"run"}'::jsonb
  );
  $cron$
);
