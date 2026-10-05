begin;
select plan(1);
select set_config('jobpilot.test.owner', (select id::text from auth.users order by created_at limit 1), true);
select set_config('jobpilot.test.other', (select id::text from auth.users order by created_at limit 1 offset 1), true);
insert into public.jobs(id,external_id,title,source,application_url)
values ('00000000-0000-4000-8000-000000000041','history-security-test','History fixture','himalayas','https://example.com/history');
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('jobpilot.test.owner'),'role','authenticated')::text,true);
insert into public.applications(id,user_id,job_id,status)
values ('00000000-0000-4000-8000-000000000041',auth.uid(),'00000000-0000-4000-8000-000000000041','saved');
update public.applications set notes='Recruiter called',status='screening',version=version+1 where id='00000000-0000-4000-8000-000000000041';
update public.applications set version=version+1 where id='00000000-0000-4000-8000-000000000041';
do $$ begin
  if (select count(*) from public.application_events where application_id='00000000-0000-4000-8000-000000000041') <> 2 then raise exception 'Missing history or no-op event'; end if;
  if not exists(select 1 from public.application_events where application_id='00000000-0000-4000-8000-000000000041' and kind='updated' and changes->'status'->>'from'='saved' and changes->'status'->>'to'='screening' and changes->'notes'->>'to'='Recruiter called' and actor_id=auth.uid()) then raise exception 'Incorrect changes or actor'; end if;
  begin update public.application_events set changes='{}'; raise exception 'History editable'; exception when insufficient_privilege then null; end;
  begin delete from public.application_events; raise exception 'History deletable'; exception when insufficient_privilege then null; end;
  begin insert into public.application_events(application_id,user_id,kind,changes) values('00000000-0000-4000-8000-000000000041',auth.uid(),'updated','{}'); raise exception 'History forgeable'; exception when insufficient_privilege then null; end;
  begin perform jobpilot_private.record_application_event(); raise exception 'Private function callable'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('jobpilot.test.other'),'role','authenticated')::text,true);
do $$ begin
  if exists(select 1 from public.application_events where application_id='00000000-0000-4000-8000-000000000041') then raise exception 'History leaked to another owner'; end if;
end $$;
reset role;
update public.applications set follow_up_at=now() where id='00000000-0000-4000-8000-000000000041';
do $$ begin
  if (select count(*) from public.application_events where application_id='00000000-0000-4000-8000-000000000041') <> 3 then raise exception 'System update untracked'; end if;
end $$;
delete from public.applications where id='00000000-0000-4000-8000-000000000041';
do $$ begin
  if exists(select 1 from public.application_events where application_id='00000000-0000-4000-8000-000000000041') then raise exception 'Deleted application history retained'; end if;
end $$;
select pass('history records real changes, suppresses no-ops, stays private and immutable, and cascades deletion');
select * from finish();
rollback;
