-- Migration 003: expose only public feed fields; keep subscriber ids server-side.
-- Apply through the Supabase migration pipeline, then verify with two different users.

create or replace view public.ideas_public as
select i.id, i.content, i.created_at, p.guest_number
from public.ideas i
join public.profiles p on p.id = i.subscriber_id;

create or replace view public.idea_replies_public as
select r.id, r.idea_id, r.content, r.created_at, p.guest_number
from public.idea_replies r
join public.profiles p on p.id = r.subscriber_id;

grant select on public.ideas_public, public.idea_replies_public to authenticated;
revoke select on public.profiles, public.ideas, public.idea_replies from anon, authenticated;

create or replace function public.my_guest_number()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select guest_number from public.profiles where id = auth.uid();
$$;
revoke execute on function public.my_guest_number() from public, anon;
grant execute on function public.my_guest_number() to authenticated;

-- The feed is intentionally visible to authenticated members through the views only.
drop policy if exists profiles_read on public.profiles;
drop policy if exists ideas_read on public.ideas;
drop policy if exists replies_read on public.idea_replies;
