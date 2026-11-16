begin;
drop policy if exists saves_read on public.saves;
create policy saves_read on public.saves for select to authenticated using ((select auth.uid()) = user_id);
revoke select on public.saves from anon;
alter table public.profiles add column if not exists net_worth bigint not null default 0;
alter table public.profiles add column if not exists level integer not null default 1;
alter table public.profiles add column if not exists xp bigint not null default 0;
alter table public.profiles add column if not exists profit bigint not null default 0;
commit;