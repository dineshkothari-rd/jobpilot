-- Administrator check; synthetic data and claims are rolled back.
begin;
select plan(1);
do $$
declare owner_id uuid; privilege_name text;
begin
  select id into owner_id from auth.users limit 1;
  if owner_id is null then raise exception 'An existing account is required'; end if;
  perform set_config('practice.test_owner', owner_id::text, true);
  perform set_config('practice.test_id', gen_random_uuid()::text, true);
  if not (select relrowsecurity from pg_class where oid = 'public.interview_practice_sessions'::regclass) then raise exception 'RLS disabled'; end if;
  if not has_table_privilege('authenticated', 'public.interview_practice_sessions', 'SELECT') then raise exception 'Owner reads unavailable'; end if;
  foreach privilege_name in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE'] loop
    if has_table_privilege('anon', 'public.interview_practice_sessions', privilege_name) then raise exception 'Anonymous privilege: %', privilege_name; end if;
    if privilege_name <> 'SELECT' and has_table_privilege('authenticated', 'public.interview_practice_sessions', privilege_name) then raise exception 'Direct client write privilege: %', privilege_name; end if;
  end loop;
end $$;
insert into public.interview_practice_sessions(id,user_id,role,topic,mode,minutes,questions)
values(current_setting('practice.test_id')::uuid,current_setting('practice.test_owner')::uuid,'Synthetic check','react','technical',10,'[{"id":"synthetic"}]');
select set_config('request.jwt.claim.sub', current_setting('practice.test_owner'), true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.interview_practice_sessions where id = current_setting('practice.test_id')::uuid) <> 1 then raise exception 'Owner read failed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.interview_practice_sessions where id = current_setting('practice.test_id')::uuid) <> 0 then raise exception 'Other-owner data exposed'; end if;
end $$;
reset role;
select pass('interview practice security assertions completed');
select * from finish();
rollback;
