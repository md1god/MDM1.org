-- Migration 003 - join form: a visitor becomes a subscriber only after confirming the e-mail link (already applied live).
alter table public.subscribers add column if not exists country text check (country is null or char_length(country) between 2 and 60);
alter table public.subscribers add column if not exists user_id uuid unique references auth.users(id) on delete set null;
alter table public.subscribers add column if not exists confirmed_at timestamptz;

create or replace function public.sync_subscriber()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.subscribers (email, first_name, country, user_id, confirmed_at)
  values (
    lower(new.email),
    nullif(left(btrim(coalesce(new.raw_user_meta_data->>'name', '')), 80), ''),
    nullif(left(btrim(coalesce(new.raw_user_meta_data->>'country', '')), 60), ''),
    new.id,
    new.email_confirmed_at
  )
  on conflict (email) do update
    set user_id = excluded.user_id,
        confirmed_at = coalesce(public.subscribers.confirmed_at, excluded.confirmed_at);
  return new;
end $$;
revoke execute on function public.sync_subscriber() from public, anon, authenticated;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after insert or update of email_confirmed_at on auth.users
  for each row when (new.email_confirmed_at is not null and new.email is not null)
  execute function public.sync_subscriber();

insert into public.subscribers (email, first_name, country, user_id, confirmed_at)
select lower(u.email), nullif(left(btrim(coalesce(u.raw_user_meta_data->>'name','')),80),''),
       nullif(left(btrim(coalesce(u.raw_user_meta_data->>'country','')),60),''), u.id, u.email_confirmed_at
from auth.users u where u.email_confirmed_at is not null and u.email is not null
on conflict (email) do nothing;

drop policy if exists subscribers_insert on public.subscribers;
revoke all on public.subscribers from anon, authenticated;

create or replace function public.subscriber_count()
returns bigint language sql security definer set search_path = public stable as $$
  select count(*) from public.subscribers where confirmed_at is not null;
$$;
grant execute on function public.subscriber_count() to anon, authenticated;
