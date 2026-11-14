-- Each person can tailor the program: remove lifts and add their own.
--   program_custom = { removed: [exercise keys], added: { partId: [{ key, name }] } }
alter table public.profiles add column if not exists program_custom jsonb;
