-- Migration 001 - ads v2 + subscribers (already applied to the live project)
-- 1) The live project currently has an OLD, empty `ads` table (title/details/location) with open policies.
--    It is renamed to ads_legacy and locked (not dropped) so nothing is lost.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='ads' and column_name='details')
     and not exists (select 1 from information_schema.tables where table_schema='public' and table_name='ads_legacy') then
    alter table public.ads rename to ads_legacy;
    drop policy if exists "Enable insert for everyone" on public.ads_legacy;
    drop policy if exists "Enable read for everyone" on public.ads_legacy;
    revoke all on public.ads_legacy from anon, authenticated;
  end if;
end $$;

-- 2) ads v2 (identical to supabase/ads.sql)

create table if not exists public.ads (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('offer','request')),
  category    text not null check (category in ('services','jobs','food','goods','education','other')),
  title       text not null check (char_length(title) between 3 and 120),
  body        text not null check (char_length(body) between 10 and 1500),
  country     text not null check (char_length(country) between 2 and 60),
  city        text check (char_length(city) <= 60),
  contact     text not null check (char_length(contact) between 3 and 120),
  status      text not null default 'active' check (status in ('active','hidden')),
  owner_hash  text not null check (char_length(owner_hash) = 64),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '30 days')
);

create table if not exists public.ad_reports (
  ad_id        uuid not null references public.ads(id) on delete cascade,
  reporter_id  text not null check (char_length(reporter_id) between 8 and 64),
  reason       text check (char_length(reason) <= 200),
  created_at   timestamptz not null default now(),
  primary key (ad_id, reporter_id)
);

alter table public.ads enable row level security;
alter table public.ad_reports enable row level security;

revoke all on public.ads from anon, authenticated;
revoke all on public.ad_reports from anon, authenticated;
grant select (id, type, category, title, body, country, city, contact, created_at, expires_at, status) on public.ads to anon, authenticated;
grant insert (id, type, category, title, body, country, city, contact, owner_hash) on public.ads to anon, authenticated;

drop policy if exists ads_read on public.ads;
create policy ads_read on public.ads for select
  using (status = 'active' and expires_at > now());

drop policy if exists ads_insert on public.ads;
create policy ads_insert on public.ads for insert
  with check (status = 'active');

create or replace function public.report_ad(p_ad_id uuid, p_reporter text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.ad_reports(ad_id, reporter_id, reason)
  values (p_ad_id, left(p_reporter, 64), left(p_reason, 200))
  on conflict do nothing;
  if (select count(*) from public.ad_reports where ad_id = p_ad_id) >= 3 then
    update public.ads set status = 'hidden' where id = p_ad_id;
  end if;
end $$;

create or replace function public.delete_my_ad(p_ad_id uuid, p_token text)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.ads
  where id = p_ad_id and owner_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex');
  get diagnostics n = row_count;
  return n > 0;
end $$;

grant execute on function public.report_ad(uuid, text, text) to anon, authenticated;
grant execute on function public.delete_my_ad(uuid, text) to anon, authenticated;



-- 3) subscribers: visitors can only add themselves and read a total count (never the emails)
create or replace function public.subscriber_count()
returns bigint language sql security definer set search_path = public stable as $$
  select count(*) from public.subscribers;
$$;
grant execute on function public.subscriber_count() to anon, authenticated;

drop policy if exists "Enable insert for subscribers" on public.subscribers;
drop policy if exists subscribers_insert on public.subscribers;
create policy subscribers_insert on public.subscribers for insert
  with check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254);
revoke all on public.subscribers from anon, authenticated;
grant insert (email, first_name, last_name) on public.subscribers to anon, authenticated;
