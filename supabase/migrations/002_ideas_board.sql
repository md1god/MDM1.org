-- Migration 002 - members' ideas board (pages/ideas.html). Already applied to the live project.
create sequence if not exists public.guest_number_seq start 1;

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  guest_number integer not null unique default nextval('public.guest_number_seq'),
  created_at   timestamptz not null default now()
);
create table if not exists public.ideas (
  id            uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  content       text not null check (char_length(btrim(content)) between 3 and 1000),
  created_at    timestamptz not null default now()
);
create table if not exists public.idea_replies (
  id            uuid primary key default gen_random_uuid(),
  idea_id       uuid not null references public.ideas(id) on delete cascade,
  subscriber_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  content       text not null check (char_length(btrim(content)) between 1 and 600),
  created_at    timestamptz not null default now()
);
create index if not exists ideas_created_idx on public.ideas (created_at desc);
create index if not exists idea_replies_idea_idx on public.idea_replies (idea_id, created_at);
create index if not exists ideas_subscriber_idx on public.ideas (subscriber_id);
create index if not exists idea_replies_subscriber_idx on public.idea_replies (subscriber_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
insert into public.profiles (id) select id from auth.users on conflict do nothing;

alter table public.profiles enable row level security;
alter table public.ideas enable row level security;
alter table public.idea_replies enable row level security;

revoke all on public.profiles, public.ideas, public.idea_replies from anon, authenticated;
grant select (id, guest_number) on public.profiles to authenticated;
grant select on public.ideas to authenticated;
grant insert (content) on public.ideas to authenticated;
grant select on public.idea_replies to authenticated;
grant insert (idea_id, content) on public.idea_replies to authenticated;
grant usage on sequence public.guest_number_seq to authenticated;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists ideas_read on public.ideas;
create policy ideas_read on public.ideas for select to authenticated using (true);
drop policy if exists ideas_insert on public.ideas;
create policy ideas_insert on public.ideas for insert to authenticated with check (subscriber_id = (select auth.uid()));
drop policy if exists replies_read on public.idea_replies;
create policy replies_read on public.idea_replies for select to authenticated using (true);
drop policy if exists replies_insert on public.idea_replies;
create policy replies_insert on public.idea_replies for insert to authenticated with check (subscriber_id = (select auth.uid()));

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ideas') then
    alter publication supabase_realtime add table public.ideas; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='idea_replies') then
    alter publication supabase_realtime add table public.idea_replies; end if;
end $$;
