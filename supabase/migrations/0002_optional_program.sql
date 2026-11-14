-- Programs become optional. program_id names the program a person is following;
-- null means they are not following one. Existing profiles were all created on
-- the 12-week plan, so they keep it.
alter table public.profiles add column if not exists program_id text;
update public.profiles set program_id = 'periodization-12' where program_id is null;
