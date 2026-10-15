-- صفحة الإعلانات المجانية (pages/ads.html)
-- شغّل هذا الملف كاملاً مرة واحدة من Supabase: SQL Editor > New query > Run
-- مهم: في الموقع نستخدم مفتاح anon فقط. لا تضع مفتاح service_role في أي ملف أو في الريبو أبداً.

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

-- الزائر يقرأ الإعلانات النشطة غير المنتهية فقط، ولا يرى owner_hash أبداً
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

-- إبلاغ: 3 بلاغات من أشخاص مختلفين يخفون الإعلان تلقائياً حتى تراجعه أنت
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

-- حذف إعلانك أنت: الكود السري يُحفظ في متصفحك فقط
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

-- لحذف إعلان مخالف فوراً: من Supabase > Table Editor > ads > احذف الصف، أو شغّل:
--   delete from public.ads where id = '<id>';
-- لمراجعة المخفي بالبلاغات:
--   select a.id, a.title, a.contact, count(r.*) as reports from public.ads a join public.ad_reports r on r.ad_id = a.id where a.status='hidden' group by a.id;
