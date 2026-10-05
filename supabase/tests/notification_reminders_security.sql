begin;
select plan(1);
select set_config('jobpilot.test.owner',(select id::text from auth.users order by created_at limit 1),true);
select set_config('jobpilot.test.other',(select id::text from auth.users order by created_at limit 1 offset 1),true);
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('jobpilot.test.owner'),'role','authenticated')::text,true);
insert into public.notification_preferences(user_id,email_enabled,push_enabled,timezone) values(auth.uid(),true,true,'Asia/Kolkata')
on conflict(user_id) do update set email_enabled=excluded.email_enabled;
insert into public.push_subscriptions(user_id,endpoint,p256dh,auth)
select auth.uid(),'https://fcm.googleapis.com/fixture/'||i,repeat('a',87),repeat('a',22) from generate_series(1,10)i;
do $$ begin
  begin insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values(auth.uid(),'https://fcm.googleapis.com/too-many',repeat('a',87),repeat('a',22)); raise exception 'Device limit missing'; exception when raise_exception then if sqlerrm <> 'push_device_limit' then raise; end if; end;
  begin insert into public.notification_preferences(user_id) values(current_setting('jobpilot.test.other')::uuid); raise exception 'Forged owner accepted'; exception when insufficient_privilege then null; end;
  begin update public.notification_preferences set timezone='fake/zone' where user_id=auth.uid(); raise exception 'Bad timezone accepted'; exception when raise_exception then if sqlerrm <> 'Invalid reminder timezone' then raise; end if; end;
  begin perform public.claim_reminder(auth.uid(),current_date,'email','email'); raise exception 'Client claimed a delivery'; exception when insufficient_privilege then null; end;
  begin insert into public.reminder_deliveries(user_id,run_day,channel,recipient_key) values(auth.uid(),current_date,'email','email'); raise exception 'Client forged delivery'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('jobpilot.test.other'),'role','authenticated')::text,true);
do $$ begin
  if exists(select 1 from public.notification_preferences) or exists(select 1 from public.push_subscriptions) then raise exception 'Foreign reminder data visible'; end if;
  delete from public.push_subscriptions; if found then raise exception 'Foreign subscription deleted'; end if;
end $$;
reset role;
set local role service_role;
do $$ declare owner uuid:=current_setting('jobpilot.test.owner')::uuid; claim record; begin
  select * into claim from public.claim_reminder(owner,current_date,'email','email');
  if claim.id is null or claim.attempts<>1 then raise exception 'First claim failed'; end if;
  if exists(select 1 from public.claim_reminder(owner,current_date,'email','email')) then raise exception 'Concurrent claim accepted'; end if;
  update public.reminder_deliveries set status='failed' where id=claim.id;
  select * into claim from public.claim_reminder(owner,current_date,'email','email');
  if claim.attempts<>2 then raise exception 'Retry failed'; end if;
  update public.reminder_deliveries set status='sent' where id=claim.id and attempts=1;
  if found then raise exception 'Stale worker overwrote retry'; end if;
  update public.reminder_deliveries set lease_until=now()-interval '1 minute' where id=claim.id;
  select * into claim from public.claim_reminder(owner,current_date,'email','email');
  if claim.attempts<>3 then raise exception 'Expired lease retry failed'; end if;
  update public.reminder_deliveries set status='failed' where id=claim.id;
  if exists(select 1 from public.claim_reminder(owner,current_date,'email','email')) then raise exception 'Retry limit missing'; end if;
  update public.reminder_deliveries set attempts=1,status='sent' where id=claim.id;
  if exists(select 1 from public.claim_reminder(owner,current_date,'email','email')) then raise exception 'Sent delivery reclaimed'; end if;
  if exists(select 1 from public.claim_reminder(owner,current_date-1,'email','email')) then raise exception 'Stale day accepted'; end if;
  if exists(select 1 from public.claim_reminder(owner,current_date,'push',gen_random_uuid()::text)) then raise exception 'Foreign browser claimed'; end if;
end $$;
insert into public.account_deletion_requests(user_id) values(current_setting('jobpilot.test.owner')::uuid);
do $$ begin
  if exists(select 1 from public.claim_reminder(current_setting('jobpilot.test.owner')::uuid,current_date,'push',(select id::text from public.push_subscriptions limit 1))) then raise exception 'Deleting account reminder claimed'; end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('jobpilot.test.owner'),'role','authenticated')::text,true);
do $$ begin
  begin update public.notification_preferences set push_enabled=true where user_id=auth.uid(); raise exception 'Deleting account enabled reminders'; exception when insufficient_privilege then null; end;
end $$;
reset role;
delete from auth.users where id=current_setting('jobpilot.test.owner')::uuid;
do $$ begin
  if exists(select 1 from public.notification_preferences) or exists(select 1 from public.push_subscriptions) or exists(select 1 from public.reminder_deliveries) then raise exception 'Account reminder cascade failed'; end if;
end $$;
select pass('reminder privacy, opt-in, device cap, worker-only claims, leases, deduplication and deletion guards pass');
select * from finish();
rollback;
