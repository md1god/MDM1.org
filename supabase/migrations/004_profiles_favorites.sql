-- MDM1 migration 004: profiles and cross-device favorites
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_id text not null check (char_length(resource_id) between 1 and 500),
  resource_type text not null default 'resource' check (resource_type in ('tool','app','game','project','resource')),
  created_at timestamptz not null default now(),
  primary key (user_id, resource_id)
);
alter table public.profiles enable row level security;
alter table public.favorites enable row level security;
drop policy if exists "Users can read their profile" on public.profiles;
drop policy if exists "Users can insert their profile" on public.profiles;
drop policy if exists "Users can update their profile" on public.profiles;
drop policy if exists "Users can read their favorites" on public.favorites;
drop policy if exists "Users can add their favorites" on public.favorites;
drop policy if exists "Users can remove their favorites" on public.favorites;
create policy "Users can read their profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can insert their profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update their profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can read their favorites" on public.favorites for select using (auth.uid() = user_id);
create policy "Users can add their favorites" on public.favorites for insert with check (auth.uid() = user_id);
create policy "Users can remove their favorites" on public.favorites for delete using (auth.uid() = user_id);
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))) on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
