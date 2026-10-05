begin;
select plan(1);
select set_config('jobpilot.test.application',(select id::text from public.applications order by created_at limit 1),true);
select set_config('jobpilot.test.owner',(select user_id::text from public.applications where id=current_setting('jobpilot.test.application')::uuid),true);
select set_config('jobpilot.test.other',(select id::text from auth.users where id<>current_setting('jobpilot.test.owner')::uuid limit 1),true);
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('jobpilot.test.owner'),'role','authenticated')::text,true);
insert into public.application_interviews(id,user_id,application_id,round,starts_at,timezone,duration_minutes,notes,outcome)
values('00000000-0000-4000-8000-000000000035',auth.uid(),current_setting('jobpilot.test.application')::uuid,'Original','2026-10-06T03:30:00Z','Asia/Kolkata',60,'Private notes','Private outcome');
do $$ begin
  begin perform public.claim_calendar_sync(auth.uid(),gen_random_uuid(),gen_random_uuid());raise exception 'Client claimed sync';exception when insufficient_privilege then null;end;
  begin perform public.store_calendar_connection(gen_random_uuid(),auth.uid(),'google','token','token',now());raise exception 'Client stored tokens';exception when insufficient_privilege then null;end;
  begin perform public.import_calendar_round(auth.uid(),gen_random_uuid(),1,'{}','etag');raise exception 'Client imported round';exception when insufficient_privilege then null;end;
  begin insert into public.calendar_connections(user_id,provider) values(auth.uid(),'google');raise exception 'Client forged connection';exception when insufficient_privilege then null;end;
  begin perform 1 from public.calendar_tokens;raise exception 'Client read tokens';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role service_role;
select public.store_calendar_connection('00000000-0000-4000-8000-000000000037',current_setting('jobpilot.test.owner')::uuid,'google','encrypted-access','encrypted-refresh',now()+interval '1 hour');
select public.store_calendar_connection('00000000-0000-4000-8000-000000000038',current_setting('jobpilot.test.other')::uuid,'google','other-access','other-refresh',now()+interval '1 hour');
insert into public.calendar_event_links(id,user_id,connection_id,interview_id,event_id,etag)
values('00000000-0000-4000-8000-000000000039',current_setting('jobpilot.test.owner')::uuid,'00000000-0000-4000-8000-000000000037','00000000-0000-4000-8000-000000000035','event','v1');
do $$ declare owner uuid:=current_setting('jobpilot.test.owner')::uuid; begin
  if not public.claim_calendar_sync(owner,'00000000-0000-4000-8000-000000000037',gen_random_uuid()) then raise exception 'First lease failed';end if;
  if public.claim_calendar_sync(owner,'00000000-0000-4000-8000-000000000037',gen_random_uuid()) then raise exception 'Concurrent lease allowed';end if;
  if public.claim_calendar_sync(current_setting('jobpilot.test.other')::uuid,'00000000-0000-4000-8000-000000000037',gen_random_uuid()) then raise exception 'Foreign lease allowed';end if;
  begin insert into public.calendar_event_links(user_id,connection_id,interview_id) values(owner,'00000000-0000-4000-8000-000000000038','00000000-0000-4000-8000-000000000035');raise exception 'Foreign connection link allowed';exception when foreign_key_violation then null;end;
  perform public.import_calendar_round(owner,'00000000-0000-4000-8000-000000000039',1,'{"round":"Imported","duration_minutes":45,"location":"Office","starts_at":"2026-10-07T03:30:00Z","status":"scheduled"}','v2');
  if not exists(select 1 from public.application_interviews where round='Imported' and version=2 and notes='Private notes' and outcome='Private outcome' and timezone='Asia/Kolkata') then raise exception 'Import lost private data';end if;
  begin perform public.import_calendar_round(owner,'00000000-0000-4000-8000-000000000039',1,'{"round":"Stale"}','v3');raise exception 'Stale import succeeded';exception when raise_exception then if sqlerrm<>'calendar_version_conflict' then raise;end if;end;
  begin perform public.import_calendar_round(owner,'00000000-0000-4000-8000-000000000039',2,'{"duration_minutes":1}','v3');raise exception 'Invalid duration accepted';exception when check_violation then null;end;
  if not exists(select 1 from public.calendar_event_links where etag='v2') then raise exception 'Failed import advanced etag';end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('jobpilot.test.owner'),'role','authenticated')::text,true);
do $$ begin
  if (select count(id) from public.calendar_connections)<>1 then raise exception 'Connection ownership read failed';end if;
  begin perform lease_token from public.calendar_connections;raise exception 'Client read lease token';exception when insufficient_privilege then null;end;
  if (select count(*) from public.calendar_event_links)<>1 then raise exception 'Owner link read failed';end if;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('jobpilot.test.other'),'role','authenticated')::text,true);
do $$ begin
  if exists(select 1 from public.calendar_event_links) then raise exception 'Foreign links visible';end if;
end $$;
reset role;
insert into public.account_deletion_requests(user_id) values(current_setting('jobpilot.test.owner')::uuid);
set local role service_role;
update public.calendar_connections set lease_until=null where user_id=current_setting('jobpilot.test.owner')::uuid;
do $$ begin
  if public.claim_calendar_sync(current_setting('jobpilot.test.owner')::uuid,'00000000-0000-4000-8000-000000000037',gen_random_uuid()) then raise exception 'Deleting account claimed sync';end if;
  begin perform public.store_calendar_connection(gen_random_uuid(),current_setting('jobpilot.test.owner')::uuid,'outlook','access','refresh',now());raise exception 'Deleting account stored connection';exception when raise_exception then if sqlerrm<>'Account deletion pending' then raise;end if;end;
end $$;
reset role;
delete from auth.users where id=current_setting('jobpilot.test.owner')::uuid;
do $$ begin
  if exists(select 1 from public.calendar_connections where user_id=current_setting('jobpilot.test.owner')::uuid) or exists(select 1 from public.calendar_event_links where user_id=current_setting('jobpilot.test.owner')::uuid) or exists(select 1 from public.calendar_tokens where connection_id='00000000-0000-4000-8000-000000000037') then raise exception 'Calendar deletion cascade failed';end if;
  if not exists(select 1 from public.calendar_tokens where connection_id='00000000-0000-4000-8000-000000000038') then raise exception 'Foreign credentials deleted';end if;
end $$;
select pass('calendar ownership, server-only encrypted credential storage, leases, atomic imports and deletion guards pass');
select * from finish();
rollback;
