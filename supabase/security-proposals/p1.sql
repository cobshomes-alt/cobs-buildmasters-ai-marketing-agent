-- REVIEW PROPOSAL ONLY. No production execution authorized.
-- Captured 2026-10-15 from ldnyctzrgcpcjmhnrpms; abort on drift.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $guard$ begin
 if not exists(select 1 from pg_proc where oid='public.cobs_is_owner()'::regprocedure and pg_get_userbyid(proowner)='postgres' and md5(pg_get_functiondef(oid))='fa0ba4c24e7295672568d8c9f2c6f360' and proacl @> array['=X/postgres'::aclitem,'postgres=X/postgres'::aclitem,'anon=X/postgres'::aclitem,'authenticated=X/postgres'::aclitem,'service_role=X/postgres'::aclitem] and proacl <@ array['=X/postgres'::aclitem,'postgres=X/postgres'::aclitem,'anon=X/postgres'::aclitem,'authenticated=X/postgres'::aclitem,'service_role=X/postgres'::aclitem]) then
  raise exception 'Function definition/owner/ACL drift: cobs_is_owner; stop and recapture';
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='cobs_campaigns' and policyname='owner manages COBS campaigns' and roles=array['public']::name[] and cmd='ALL' and permissive='PERMISSIVE' and qual='cobs_is_owner()' and with_check='cobs_is_owner()') then raise exception 'Policy drift: owner manages COBS campaigns'; end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='cobs_leads' and policyname='owner manages COBS leads' and roles=array['public']::name[] and cmd='ALL' and permissive='PERMISSIVE' and qual='cobs_is_owner()' and with_check='cobs_is_owner()') then raise exception 'Policy drift: owner manages COBS leads'; end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='cobs_posts' and policyname='owner manages COBS posts' and roles=array['public']::name[] and cmd='ALL' and permissive='PERMISSIVE' and qual='cobs_is_owner()' and with_check='cobs_is_owner()') then raise exception 'Policy drift: owner manages COBS posts'; end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='cobs_media_assets' and policyname='owner manages cobs media assets' and roles=array['public']::name[] and cmd='ALL' and permissive='PERMISSIVE' and qual='cobs_is_owner()' and with_check='cobs_is_owner()') then raise exception 'Policy drift: owner manages cobs media assets'; end if;
end $guard$;
alter policy "owner manages COBS campaigns" on public."cobs_campaigns" to authenticated;
alter policy "owner manages COBS leads" on public."cobs_leads" to authenticated;
alter policy "owner manages COBS posts" on public."cobs_posts" to authenticated;
alter policy "owner manages cobs media assets" on public."cobs_media_assets" to authenticated;
revoke execute on function public.cobs_is_owner() from public, anon;
commit;
