-- Pixel Gambit online layer v1: accounts, cloud saves, public standings.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'Guest',
  character jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  world jsonb not null,
  net_worth bigint not null default 0,
  level integer not null default 1,
  updated_at timestamptz not null default now()
);

create index if not exists saves_net_worth_idx on public.saves (net_worth desc);

alter table public.profiles enable row level security;
alter table public.saves enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select
  to anon, authenticated using (true);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert
  to authenticated with check ((select auth.uid()) = id);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists saves_read on public.saves;
create policy saves_read on public.saves for select
  to anon, authenticated using (true);

drop policy if exists saves_insert on public.saves;
create policy saves_insert on public.saves for insert
  to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists saves_update on public.saves;
create policy saves_update on public.saves for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Tables created via SQL are not auto-exposed to the Data API (2026-10-30 enforcement).
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.saves to anon, authenticated;
grant insert, update on public.profiles, public.saves to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), 'Guest'))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_save()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke execute on function public.touch_save() from public, anon, authenticated;

drop trigger if exists saves_touch on public.saves;
create trigger saves_touch
  before update on public.saves
  for each row execute function public.touch_save();