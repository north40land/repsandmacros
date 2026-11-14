-- Phase 5: progress photos. (The body_metrics table arrived early, in 0005.)
--
-- Pictures live in a private storage bucket. Each person can only reach files inside
-- the folder named after their own user id: <user id>/<date>/<pose>-<random>.jpg

create table public.progress_photos (
  id           uuid primary key,
  user_id      uuid not null references auth.users on delete cascade,
  taken_on     date not null,
  pose         text not null check (pose in ('front', 'side', 'back')),
  storage_path text not null,
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  synced_at    timestamptz not null default now()
);
alter table public.progress_photos enable row level security;
create policy "own rows" on public.progress_photos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger touch_synced_at before insert or update on public.progress_photos
  for each row execute function public.touch_synced_at();
create index progress_photos_sync_idx on public.progress_photos (user_id, synced_at);
revoke all on public.progress_photos from anon;
grant select, insert, update on public.progress_photos to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "progress photos: read own" on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "progress photos: add own" on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "progress photos: change own" on storage.objects for update to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "progress photos: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
