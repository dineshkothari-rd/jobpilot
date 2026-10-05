begin;
select plan(1);
insert into auth.users(id,email,raw_user_meta_data)
values ('00000000-0000-4000-8000-000000000040','account-delete-fixture@example.com','{}');
select set_config('jobpilot.test.other', (select id::text from auth.users where id <> '00000000-0000-4000-8000-000000000040' order by created_at limit 1), true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000040","role":"authenticated"}',true);
insert into public.jobs(id,external_id,title,company_name,source,application_url,created_by)
values ('00000000-0000-4000-8000-000000000040','account-owned-fixture','My private job','Fixture','user','https://example.com/account','00000000-0000-4000-8000-000000000040');
insert into public.applications(user_id,job_id,status)
values (auth.uid(),'00000000-0000-4000-8000-000000000040','saved');
insert into storage.objects(bucket_id,name,owner_id)
values ('resumes',auth.uid()::text || '/before-freeze.pdf',auth.uid()::text);
do $$ begin
  begin insert into public.account_deletion_requests(user_id) values(auth.uid()); raise exception 'Client forged deletion state'; exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.account_deletion_requests(user_id) values('00000000-0000-4000-8000-000000000040');
insert into public.job_reports(job_id,user_id,category,details)
values ('00000000-0000-4000-8000-000000000020',current_setting('jobpilot.test.other')::uuid,'payment','Foreign private report must remain private.');
set local role authenticated;
do $$ begin
  if not exists(select 1 from public.account_deletion_requests where user_id=auth.uid()) then raise exception 'Owner cannot see deletion state'; end if;
  begin insert into storage.objects(bucket_id,name,owner_id) values('resumes',auth.uid()::text || '/after-freeze.pdf',auth.uid()::text); raise exception 'Frozen account upload allowed'; exception when insufficient_privilege then null; end;
  begin delete from public.account_deletion_requests where user_id=auth.uid(); raise exception 'Client unfroze deletion'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('jobpilot.test.other'),'role','authenticated')::text,true);
do $$ begin
  if exists(select 1 from public.account_deletion_requests where user_id='00000000-0000-4000-8000-000000000040') then raise exception 'Foreign deletion marker visible'; end if;
end $$;
reset role;
-- Rollback-only metadata fixture cleanup, never use SQL to remove real Storage files.
select set_config('storage.allow_delete_query','true',true);
delete from storage.objects where bucket_id='resumes' and name='00000000-0000-4000-8000-000000000040/before-freeze.pdf';
delete from auth.users where id='00000000-0000-4000-8000-000000000040';
do $$ begin
  if exists(select 1 from public.jobs where id='00000000-0000-4000-8000-000000000040')
    or exists(select 1 from public.profiles where id='00000000-0000-4000-8000-000000000040')
    or exists(select 1 from public.applications where user_id='00000000-0000-4000-8000-000000000040')
    or exists(select 1 from public.application_events where user_id='00000000-0000-4000-8000-000000000040')
    or exists(select 1 from public.account_deletion_requests where user_id='00000000-0000-4000-8000-000000000040') then raise exception 'Account deletion failed to cascade'; end if;
  if not exists(select 1 from public.job_reports where user_id=current_setting('jobpilot.test.other')::uuid and job_id='00000000-0000-4000-8000-000000000020') then raise exception 'Another account report was deleted'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000040","role":"authenticated","app_metadata":{"role":"admin"}}',true);
do $$ begin
  if exists(select 1 from public.jobs) or exists(select 1 from public.job_reports) then raise exception 'Deleted account JWT retained privileged reads'; end if;
  begin insert into public.hidden_jobs(job_id) values('00000000-0000-4000-8000-000000000020'); raise exception 'Deleted admin JWT hid a job'; exception when insufficient_privilege then null; end;
  begin insert into storage.objects(bucket_id,name,owner_id) values('resumes',auth.uid()::text || '/stale-jwt.pdf',auth.uid()::text); raise exception 'Deleted account JWT uploaded a resume'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select pass('deletion markers are private and server-managed, uploads freeze, owned data cascades and stale JWT uploads are denied');
select * from finish();
rollback;
