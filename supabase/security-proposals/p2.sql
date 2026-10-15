-- REVIEW PROPOSAL ONLY. No production execution authorized.
-- Captured 2026-10-15 from ldnyctzrgcpcjmhnrpms; abort on drift.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $guard$ begin
 if not exists(select 1 from pg_proc where oid='public.cobs_new_user_profile()'::regprocedure and pg_get_userbyid(proowner)='postgres' and md5(pg_get_functiondef(oid))='f4129b6ac0c5f00c1f440b005ebbdb16' and proacl @> array['=X/postgres'::aclitem,'postgres=X/postgres'::aclitem,'anon=X/postgres'::aclitem,'authenticated=X/postgres'::aclitem,'service_role=X/postgres'::aclitem] and proacl <@ array['=X/postgres'::aclitem,'postgres=X/postgres'::aclitem,'anon=X/postgres'::aclitem,'authenticated=X/postgres'::aclitem,'service_role=X/postgres'::aclitem]) then
  raise exception 'Function definition/owner/ACL drift: cobs_new_user_profile; stop and recapture';
 end if;

end $guard$;
revoke execute on function public.cobs_new_user_profile() from public, anon, authenticated;
commit;
