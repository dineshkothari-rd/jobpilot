begin;
select plan(1);
select set_config('jobpilot.test.owner', (select id::text from auth.users order by created_at limit 1), true);
select set_config('jobpilot.test.other', (select id::text from auth.users order by created_at limit 1 offset 1), true);
do $$ begin
  if nullif(current_setting('jobpilot.test.other'), '') is null then raise exception 'Two seeded accounts required'; end if;
end $$;
insert into public.jobs(id, external_id, title, company_name, source, application_url)
values ('00000000-0000-4000-8000-000000000037','report-security-test','Security fixture','Fixture','himalayas','https://example.com/job');
insert into public.jobs(external_id,title,source,application_url)
select 'report-limit-' || i,'Limit fixture','himalayas','https://example.com/limit/' || i from generate_series(1,10) i;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',current_setting('jobpilot.test.owner'),'role','authenticated','user_metadata',json_build_object('role','admin'))::text,true);
insert into public.job_reports(job_id,user_id,category,details)
values ('00000000-0000-4000-8000-000000000037',current_setting('jobpilot.test.owner')::uuid,'payment','Asked for an upfront payment.');
do $$ begin
  if not exists(select 1 from public.jobs where id='00000000-0000-4000-8000-000000000037') then raise exception 'Pending report hid job'; end if;
  update public.job_reports set status='confirmed',reviewed_at=now(),reviewed_by=auth.uid() where job_id='00000000-0000-4000-8000-000000000037';
  if found then raise exception 'Reporter self-moderation allowed'; end if;
  begin insert into public.hidden_jobs(job_id) values('00000000-0000-4000-8000-000000000037'); raise exception 'Reporter hid job'; exception when insufficient_privilege then null; end;
  begin insert into public.job_reports(job_id,user_id,category,details) values('00000000-0000-4000-8000-000000000037',current_setting('jobpilot.test.other')::uuid,'payment','Forged another reporter'); raise exception 'Reporter impersonation allowed'; exception when insufficient_privilege then null; end;
  begin insert into public.job_reports(job_id,user_id,category,details,status) values('00000000-0000-4000-8000-000000000037',auth.uid(),'payment','Forged confirmed report','confirmed'); raise exception 'Status forgery allowed'; exception when insufficient_privilege then null; end;
end $$;
do $$ declare fixture uuid; begin
  for fixture in select id from public.jobs where external_id like 'report-limit-%' and external_id <> 'report-limit-10' loop
    insert into public.job_reports(job_id,user_id,category,details) values(fixture,auth.uid(),'payment','Requested an upfront fee');
  end loop;
  begin
    insert into public.job_reports(job_id,user_id,category,details)
    values ('00000000-0000-4000-8000-000000000037',auth.uid(),'payment','Retry at the daily cap');
    raise exception 'Duplicate report allowed';
  exception when unique_violation then null; end;
  begin
    insert into public.job_reports(job_id,user_id,category,details)
    select id,auth.uid(),'payment','One report beyond the daily limit' from public.jobs where external_id='report-limit-10';
    raise exception 'Daily cap was bypassed';
  exception when raise_exception then
    if SQLERRM <> 'Daily report limit reached' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('jobpilot.test.other'),'role','authenticated')::text,true);
do $$ begin
  if exists(select 1 from public.job_reports where job_id='00000000-0000-4000-8000-000000000037') then raise exception 'Foreign reporter data visible'; end if;
end $$;
reset role;
update auth.users set raw_app_meta_data=jsonb_set(coalesce(raw_app_meta_data,'{}'),'{role}','"admin"') where id=current_setting('jobpilot.test.other')::uuid;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('jobpilot.test.other'),'role','authenticated','app_metadata',json_build_object('role','admin'))::text,true);
update public.job_reports set status='confirmed',reviewed_at=now(),reviewed_by=auth.uid(),review_note='Confirmed scam evidence' where job_id='00000000-0000-4000-8000-000000000037';
do $$ begin
  if not exists(select 1 from public.hidden_jobs where job_id='00000000-0000-4000-8000-000000000037') then raise exception 'Confirmation did not hide job'; end if;
  update public.job_reports set status='dismissed' where job_id='00000000-0000-4000-8000-000000000037'; if found then raise exception 'Reviewed report was overwritten'; end if;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('jobpilot.test.owner'),'role','authenticated')::text,true);
do $$ begin
  if exists(select 1 from public.jobs where id='00000000-0000-4000-8000-000000000037') then raise exception 'Confirmed job still visible'; end if;
end $$;
set local role service_role;
do $$ begin
  if exists(select 1 from public.moderated_jobs where id='00000000-0000-4000-8000-000000000037') then raise exception 'Service feed includes scam'; end if;
end $$;
set local role anon;
do $$ begin
  begin perform 1 from public.job_reports; raise exception 'Anonymous reports read allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select pass('report ownership, forged admin denial, confirmation, stale review and service feed checks passed');
select * from finish();
rollback;
