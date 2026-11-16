-- Least privilege: default Supabase grants give anon/authenticated ALL on new tables.
-- TRUNCATE is not controlled by RLS, so it must be revoked explicitly.
revoke all on public.profiles, public.saves from anon, authenticated;
grant select on public.profiles, public.saves to anon, authenticated;
grant insert, update on public.profiles, public.saves to authenticated;