begin;
select set_config('jobpilot.test.application', (select id::text from public.applications order by created_at limit 1), true);
select set_config('jobpilot.test.owner', (select user_id::text from public.applications where id = current_setting('jobpilot.test.application')::uuid), true);
do $$ begin
  if nullif(current_setting('jobpilot.test.owner', true), '') is null then raise exception 'An existing application is required'; end if;
  if has_table_privilege('anon', 'public.application_interviews', 'SELECT') or has_table_privilege('authenticated', 'public.application_interviews', 'DELETE') or has_table_privilege('authenticated', 'public.application_interviews', 'TRUNCATE') then raise exception 'Unexpected client privileges'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('jobpilot.test.owner'), 'role', 'authenticated')::text, true);
insert into public.application_interviews(id,user_id,application_id,round,starts_at,timezone,duration_minutes)
values ('00000000-0000-4000-8000-000000000099',current_setting('jobpilot.test.owner')::uuid,current_setting('jobpilot.test.application')::uuid,'Security test','2026-10-01T00:00:00Z','UTC',60);
do $$ begin
  if not exists (select 1 from public.application_interviews where id='00000000-0000-4000-8000-000000000099') then raise exception 'Owner read failed'; end if;
  update public.application_interviews set notes='Owner update',version=2 where id='00000000-0000-4000-8000-000000000099';
  if not found then raise exception 'Owner update failed'; end if;
  begin update public.application_interviews set user_id='00000000-0000-4000-8000-000000000001' where id='00000000-0000-4000-8000-000000000099'; raise exception 'Owner reassignment allowed'; exception when insufficient_privilege then null; end;
  begin delete from public.application_interviews where id='00000000-0000-4000-8000-000000000099'; raise exception 'Client delete allowed'; exception when insufficient_privilege then null; end;
  begin update public.application_interviews set duration_minutes=0 where id='00000000-0000-4000-8000-000000000099'; raise exception 'Invalid duration allowed'; exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
  if exists(select 1 from public.application_interviews where id='00000000-0000-4000-8000-000000000099') then raise exception 'Foreign read allowed'; end if;
  update public.application_interviews set notes='Foreign update' where id='00000000-0000-4000-8000-000000000099';
  if found then raise exception 'Foreign update allowed'; end if;
  begin
    insert into public.application_interviews(id,user_id,application_id,round,starts_at,timezone,duration_minutes)
    values ('00000000-0000-4000-8000-000000000098','00000000-0000-4000-8000-000000000001',current_setting('jobpilot.test.application')::uuid,'Foreign application','2026-10-01T00:00:00Z','UTC',60);
    raise exception 'Foreign application attachment allowed';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin perform 1 from public.application_interviews; raise exception 'Anonymous read allowed'; exception when insufficient_privilege then null; end;
  begin update public.application_interviews set notes='Anonymous'; raise exception 'Anonymous update allowed'; exception when insufficient_privilege then null; end;
end $$;
rollback;
