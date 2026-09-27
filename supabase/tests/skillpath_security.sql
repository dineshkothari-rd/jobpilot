-- Run after the migration, as an administrator. All synthetic changes roll back.
begin;
select plan(1);

do $$
declare
  owner_id uuid;
  table_name text;
  privilege_name text;
begin
  select id into owner_id from auth.users limit 1;
  if owner_id is null then raise exception 'One existing account is required'; end if;
  perform set_config('skillpath.test_owner', owner_id::text, true);
  perform set_config('skillpath.test_path', 'security-check-' || gen_random_uuid()::text, true);
  foreach table_name in array array['skillpath_enrollments', 'skillpath_attempts', 'skillpath_credentials'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || table_name)::regclass) then
      raise exception 'RLS disabled: %', table_name;
    end if;
    if not has_table_privilege('authenticated', 'public.' || table_name, 'SELECT') then
      raise exception 'Owner reads unavailable: %', table_name;
    end if;
    foreach privilege_name in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'SELECT'] loop
      if has_table_privilege('anon', 'public.' || table_name, privilege_name) then
        raise exception 'Anonymous privilege: % %', table_name, privilege_name;
      end if;
      if privilege_name <> 'SELECT' and has_table_privilege('authenticated', 'public.' || table_name, privilege_name) then
        raise exception 'Client write privilege: % %', table_name, privilege_name;
      end if;
    end loop;
  end loop;
end $$;

insert into public.skillpath_enrollments (user_id, path_id, selected_lesson)
values (current_setting('skillpath.test_owner')::uuid, current_setting('skillpath.test_path'), 'synthetic');
insert into public.skillpath_attempts (user_id, path_id, score, answers)
values (current_setting('skillpath.test_owner')::uuid, current_setting('skillpath.test_path'), 100, array[1,0,2]);
insert into public.skillpath_credentials (user_id, kind, path_id, title, issuer, issued_on)
values (current_setting('skillpath.test_owner')::uuid, 'jobpilot', current_setting('skillpath.test_path'), 'Synthetic security check', 'JobPilot', current_date);

select set_config('request.jwt.claim.sub', current_setting('skillpath.test_owner'), true);
set local role authenticated;
do $$
declare table_name text; row_count integer;
begin
  foreach table_name in array array['skillpath_enrollments', 'skillpath_attempts', 'skillpath_credentials'] loop
    execute format('select count(*) from public.%I where path_id = $1', table_name)
      into row_count using current_setting('skillpath.test_path');
    if row_count <> 1 then raise exception 'Owner read failed: %', table_name; end if;
  end loop;
end $$;
reset role;

select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
set local role authenticated;
do $$
declare table_name text; row_count integer;
begin
  foreach table_name in array array['skillpath_enrollments', 'skillpath_attempts', 'skillpath_credentials'] loop
    execute format('select count(*) from public.%I where path_id = $1', table_name)
      into row_count using current_setting('skillpath.test_path');
    if row_count <> 0 then raise exception 'Other-account data exposed: %', table_name; end if;
  end loop;
end $$;
reset role;
select pass('skillpath security assertions completed');
select * from finish();
rollback;
