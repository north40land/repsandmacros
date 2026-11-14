-- The day a person started using the app. Days before it are left blank in the weekly
-- views instead of counting as missed or zero. New accounts set it from the phone's
-- own date; existing accounts get the day the account was created (US Central time).
alter table public.profiles add column if not exists started_on date;

update public.profiles p
   set started_on = (u.created_at at time zone 'America/Chicago')::date
  from auth.users u
 where u.id = p.id and p.started_on is null;
