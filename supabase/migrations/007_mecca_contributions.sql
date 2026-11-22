-- MDM1 migration 007: community contributions for the Mecca 3D explorer (street name fixes, notes, photos).
-- Everything a visitor submits starts as 'pending'. Only approved rows (and a user's own rows) are readable.
-- Moderation = change `status` to 'approved' / 'rejected' in the Supabase dashboard (service role only).
create table if not exists public.mecca_contrib (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('rename','note','photo')),
  street_key text check (street_key is null or char_length(street_key) <= 120),
  street_name text check (street_name is null or char_length(street_name) <= 120),
  body text not null check (char_length(body) between 1 and 500),
  x real not null check (x between -30000 and 30000),
  z real not null check (z between -30000 and 30000),
  photo_path text check (photo_path is null or char_length(photo_path) <= 200),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  check ((kind = 'photo') = (photo_path is not null))
);
create index if not exists mecca_contrib_status_idx on public.mecca_contrib (status, created_at desc);
create index if not exists mecca_contrib_user_idx on public.mecca_contrib (user_id, created_at desc);
alter table public.mecca_contrib enable row level security;
drop policy if exists "Read approved or own contributions" on public.mecca_contrib;
drop policy if exists "Add own pending contributions" on public.mecca_contrib;
drop policy if exists "Delete own pending contributions" on public.mecca_contrib;
create policy "Read approved or own contributions" on public.mecca_contrib for select to anon, authenticated
  using (status = 'approved' or user_id = auth.uid());
create policy "Add own pending contributions" on public.mecca_contrib for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');
create policy "Delete own pending contributions" on public.mecca_contrib for delete to authenticated
  using (user_id = auth.uid() and status = 'pending');

-- at most 30 submissions per user per day
create or replace function public.mecca_contrib_rate_limit() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.mecca_contrib where user_id = new.user_id and created_at > now() - interval '1 day') >= 30 then
    raise exception 'daily contribution limit reached';
  end if;
  return new;
end;
$$;
drop trigger if exists mecca_contrib_rate_limit_trg on public.mecca_contrib;
create trigger mecca_contrib_rate_limit_trg before insert on public.mecca_contrib for each row execute function public.mecca_contrib_rate_limit();

-- photo storage: public bucket (random file names), 1 MB, images only; users may only write inside their own folder
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mecca-photos', 'mecca-photos', true, 1048576, array['image/jpeg','image/webp','image/png'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Upload own mecca photos" on storage.objects;
drop policy if exists "Delete own mecca photos" on storage.objects;
create policy "Upload own mecca photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'mecca-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Delete own mecca photos" on storage.objects for delete to authenticated
  using (bucket_id = 'mecca-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- the rate-limit function is only meant to run as a trigger, never through the REST API
revoke execute on function public.mecca_contrib_rate_limit() from public, anon, authenticated;
