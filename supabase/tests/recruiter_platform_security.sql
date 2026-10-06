begin;select plan(1);
select set_config('jobpilot.test.owner',(select id::text from auth.users order by id limit 1),true);
select set_config('jobpilot.test.other',(select id::text from auth.users where id<>current_setting('jobpilot.test.owner')::uuid limit 1),true);
update auth.users set email='owner@recruiter-test.example',email_confirmed_at=now() where id=current_setting('jobpilot.test.owner')::uuid;
update auth.users set raw_app_meta_data=coalesce(raw_app_meta_data,'{}')||'{"role":"admin"}'::jsonb where id=current_setting('jobpilot.test.other')::uuid;
set local role service_role;
select set_config('jobpilot.test.company',public.register_recruiter(current_setting('jobpilot.test.owner')::uuid,'Recruiter Test','recruiter-test.example','Example Owner','https://recruiter-test.example','https://recruiter-test.example/document','Registered company hiring authority evidence')::text,true);
select set_config('jobpilot.test.request',(select id::text from public.company_verification_requests where company_id=current_setting('jobpilot.test.company')::uuid),true);
select set_config('jobpilot.test.job',public.save_recruiter_job(current_setting('jobpilot.test.owner')::uuid,current_setting('jobpilot.test.company')::uuid,null,0,'{"title":"Software engineer","description":"Build and maintain software with an experienced and collaborative team.","location":"Remote","country":"India","employment_type":"full-time","seniority":"senior","salary_min":1000000,"salary_max":2000000,"salary_currency":"INR","equity_min":0.1,"equity_max":0.2,"skills":["React"],"application_url":"https://recruiter-test.example/apply","posting_status":"draft"}'::jsonb)::text,true);
do $$ declare fields jsonb:=(select to_jsonb(j) from public.jobs j where id=current_setting('jobpilot.test.job')::uuid);begin
  begin perform public.save_recruiter_job(current_setting('jobpilot.test.owner')::uuid,current_setting('jobpilot.test.company')::uuid,current_setting('jobpilot.test.job')::uuid,1,fields||'{"posting_status":"published"}');raise exception 'Unverified published';exception when raise_exception then if sqlerrm<>'company_not_verified' then raise;end if;end;
  begin perform public.save_recruiter_job(current_setting('jobpilot.test.other')::uuid,current_setting('jobpilot.test.company')::uuid,current_setting('jobpilot.test.job')::uuid,1,fields);raise exception 'Foreign posting edit';exception when raise_exception then if sqlerrm<>'recruiter_required' then raise;end if;end;
  begin perform public.review_company_verification(current_setting('jobpilot.test.owner')::uuid,current_setting('jobpilot.test.request')::uuid,1,'approved','Checked company documents');raise exception 'Owner approved own company';exception when raise_exception then if sqlerrm<>'admin_required' then raise;end if;end;
end $$;
reset role;set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('jobpilot.test.other'),'role','authenticated')::text,true);
do $$ begin
  if exists(select 1 from public.jobs where id=current_setting('jobpilot.test.job')::uuid) then raise exception 'Draft leaked';end if;
  if exists(select 1 from public.recruiter_companies where id=current_setting('jobpilot.test.company')::uuid) or exists(select 1 from public.company_verification_requests where id=current_setting('jobpilot.test.request')::uuid) then raise exception 'Corporate evidence leaked';end if;
  begin perform public.register_recruiter(auth.uid(),'Forged','forged.example','Forged Person','https://forged.example','https://forged.example/doc','Forged evidence and permission');raise exception 'Client called onboarding RPC';exception when insufficient_privilege then null;end;
  begin update public.recruiter_companies set verification_status='verified';raise exception 'Client approved verification';exception when insufficient_privilege then null;end;
end $$;
reset role;set local role service_role;
select public.review_company_verification(current_setting('jobpilot.test.other')::uuid,current_setting('jobpilot.test.request')::uuid,1,'approved','Company registration and hiring authority reviewed');
select public.save_recruiter_job(current_setting('jobpilot.test.owner')::uuid,current_setting('jobpilot.test.company')::uuid,current_setting('jobpilot.test.job')::uuid,1,(select to_jsonb(j)||'{"posting_status":"published"}' from public.jobs j where id=current_setting('jobpilot.test.job')::uuid));
do $$ declare fields jsonb:=(select to_jsonb(j) from public.jobs j where id=current_setting('jobpilot.test.job')::uuid);begin
  if not exists(select 1 from public.moderated_jobs where id=current_setting('jobpilot.test.job')::uuid) then raise exception 'Published job absent';end if;
  begin perform public.save_recruiter_job(current_setting('jobpilot.test.owner')::uuid,current_setting('jobpilot.test.company')::uuid,current_setting('jobpilot.test.job')::uuid,1,fields);raise exception 'Stale overwrite allowed';exception when raise_exception then if sqlerrm<>'posting_conflict' then raise;end if;end;
end $$;
reset role;set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('jobpilot.test.other'),'role','authenticated')::text,true);
do $$ begin if not exists(select 1 from public.jobs where id=current_setting('jobpilot.test.job')::uuid and equity_min=0.1) then raise exception 'Verified job not discoverable';end if;end $$;
insert into public.applications(user_id,job_id,status) values(auth.uid(),current_setting('jobpilot.test.job')::uuid,'saved');
reset role;set local role service_role;
select public.review_company_verification(current_setting('jobpilot.test.other')::uuid,current_setting('jobpilot.test.request')::uuid,2,'revoked','Hiring authority no longer valid');
do $$ begin if exists(select 1 from public.moderated_jobs where id=current_setting('jobpilot.test.job')::uuid) or not exists(select 1 from public.jobs where id=current_setting('jobpilot.test.job')::uuid and posting_status='paused') then raise exception 'Revocation did not hide published job';end if;end $$;
reset role;
delete from auth.users where id=current_setting('jobpilot.test.owner')::uuid;
do $$ begin
  if exists(select 1 from public.recruiter_companies where id=current_setting('jobpilot.test.company')::uuid) then raise exception 'Company not purged';end if;
  if not exists(select 1 from public.jobs where id=current_setting('jobpilot.test.job')::uuid and posting_status='closed' and recruiter_company_id is null and company_name is null and title='Removed job posting') then raise exception 'Posting not redacted';end if;
  if not exists(select 1 from public.applications where user_id=current_setting('jobpilot.test.other')::uuid and job_id=current_setting('jobpilot.test.job')::uuid) then raise exception 'Employer deletion erased candidate history';end if;
end $$;
select pass('Recruiter platform blocks forged roles, private evidence, unverified publishing and stale writes; revocation hides jobs and deletion preserves other candidates history');select * from finish();rollback;
