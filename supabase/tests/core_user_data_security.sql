begin;
select plan(1);

select set_config('jobpilot.test.owner', '00000000-0000-4000-8000-000000000010', true);
select set_config('jobpilot.test.other', '00000000-0000-4000-8000-000000000001', true);

insert into public.jobs (id, external_id, title, source, raw_data)
values ('00000000-0000-4000-8000-000000000021', 'core-security-job', 'Core security job', 'himalayas', '{}');

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','job_preferences','resumes','saved_jobs','applications'] loop
    if has_table_privilege('anon', 'public.' || table_name, 'SELECT') then
      raise exception 'Anonymous SELECT privilege remains on %', table_name;
    end if;
    if has_table_privilege('authenticated', 'public.' || table_name, 'TRUNCATE') then
      raise exception 'Authenticated TRUNCATE privilege remains on %', table_name;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.applications', 'DELETE')
    or has_table_privilege('authenticated', 'public.profiles', 'DELETE')
    or has_table_privilege('authenticated', 'public.job_preferences', 'DELETE') then
    raise exception 'Unexpected destructive core-table privilege';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('jobpilot.test.owner'), 'role', 'authenticated')::text, true);

do $$
begin
  if not exists (select 1 from public.profiles where id = current_setting('jobpilot.test.owner')::uuid) then
    raise exception 'Owner profile read failed';
  end if;
  update public.profiles set location = 'Security test' where id = current_setting('jobpilot.test.owner')::uuid;
  if not found then raise exception 'Owner profile update failed'; end if;
end $$;

insert into public.job_preferences (id, user_id)
values ('00000000-0000-4000-8000-000000000040', current_setting('jobpilot.test.owner')::uuid);
insert into public.resumes (id, user_id, file_name)
values ('00000000-0000-4000-8000-000000000050', current_setting('jobpilot.test.owner')::uuid, 'security.pdf');
insert into public.saved_jobs (id, user_id, job_id)
values ('00000000-0000-4000-8000-000000000060', current_setting('jobpilot.test.owner')::uuid, '00000000-0000-4000-8000-000000000021');
insert into public.applications (id, user_id, job_id)
values ('00000000-0000-4000-8000-000000000031', current_setting('jobpilot.test.owner')::uuid, '00000000-0000-4000-8000-000000000021');

do $$
begin
  if not exists (
    select 1 from public.applications
    where id = '00000000-0000-4000-8000-000000000031'
      and status = 'saved'
      and version = 1
      and applied_at is null
  ) then raise exception 'Application defaults are not fail-closed'; end if;
  update public.job_preferences set remote_only = true where id = '00000000-0000-4000-8000-000000000040';
  if not found then raise exception 'Owner preferences update failed'; end if;
  update public.resumes set file_name = 'security-updated.pdf' where id = '00000000-0000-4000-8000-000000000050';
  if not found then raise exception 'Owner resume update failed'; end if;
  update public.applications set notes = 'Owner note', version = 2 where id = '00000000-0000-4000-8000-000000000031' and version = 1;
  if not found then raise exception 'Owner application update failed'; end if;
end $$;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('jobpilot.test.other'), 'role', 'authenticated')::text, true);

do $$
declare affected integer;
begin
  if exists (select 1 from public.profiles where id = current_setting('jobpilot.test.owner')::uuid)
    or exists (select 1 from public.job_preferences where id = '00000000-0000-4000-8000-000000000040')
    or exists (select 1 from public.resumes where id = '00000000-0000-4000-8000-000000000050')
    or exists (select 1 from public.saved_jobs where id = '00000000-0000-4000-8000-000000000060')
    or exists (select 1 from public.applications where id = '00000000-0000-4000-8000-000000000031') then
    raise exception 'Foreign private row read allowed';
  end if;

  update public.profiles set location = 'Tampered' where id = current_setting('jobpilot.test.owner')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Foreign profile update allowed'; end if;
  update public.resumes set file_name = 'tampered.pdf' where id = '00000000-0000-4000-8000-000000000050';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Foreign resume update allowed'; end if;
  update public.applications set notes = 'Tampered' where id = '00000000-0000-4000-8000-000000000031';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Foreign application update allowed'; end if;
  delete from public.resumes where id = '00000000-0000-4000-8000-000000000050';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Foreign resume delete allowed'; end if;
  delete from public.saved_jobs where id = '00000000-0000-4000-8000-000000000060';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Foreign saved-job delete allowed'; end if;

  begin
    insert into public.resumes (user_id, file_name) values (current_setting('jobpilot.test.owner')::uuid, 'foreign.pdf');
    raise exception 'Cross-user resume insert allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.applications (user_id, job_id) values (current_setting('jobpilot.test.owner')::uuid, '00000000-0000-4000-8000-000000000020');
    raise exception 'Cross-user application insert allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

set local role anon;
do $$
begin
  begin
    perform 1 from public.profiles;
    raise exception 'Anonymous profile read allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.saved_jobs (user_id, job_id)
    values (current_setting('jobpilot.test.owner')::uuid, '00000000-0000-4000-8000-000000000020');
    raise exception 'Anonymous saved-job insert allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('jobpilot.test.owner'), 'role', 'authenticated')::text, true);
delete from public.resumes where id = '00000000-0000-4000-8000-000000000050';
delete from public.saved_jobs where id = '00000000-0000-4000-8000-000000000060';

reset role;
select pass('core user data grants, ownership, and fail-closed defaults verified');
select * from finish();
rollback;
