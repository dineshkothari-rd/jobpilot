begin;
select plan(1);
select set_config('hiring.candidate','00000000-0000-4000-8000-000000000010',true);
select set_config('hiring.recruiter','00000000-0000-4000-8000-000000000001',true);
insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values('00000000-0000-4000-8000-000000000099','authenticated','authenticated','outsider@fixture.invalid',now(),'{"role":"admin"}','{}');
update auth.users set email_confirmed_at=now() where id in(current_setting('hiring.candidate')::uuid,current_setting('hiring.recruiter')::uuid);
update public.profiles set full_name='Candidate Fixture',target_role='Engineer',location='India' where id=current_setting('hiring.candidate')::uuid;
insert into public.resumes(id,user_id,file_name,raw_text) values('00000000-0000-4000-8000-000000000088',current_setting('hiring.candidate')::uuid,'selected.txt','Reviewed resume text'),('00000000-0000-4000-8000-000000000089',current_setting('hiring.recruiter')::uuid,'private.txt','Other candidate private resume');
set local role service_role;
select set_config('hiring.company',public.register_recruiter(current_setting('hiring.recruiter')::uuid,'Hiring Fixture','hiring.example','Fixture Recruiter','https://hiring.example','https://hiring.example/proof','Hiring authority verified by independent administrator')::text,true);
select set_config('hiring.verification',(select id::text from public.company_verification_requests where company_id=current_setting('hiring.company')::uuid),true);
select public.review_company_verification('00000000-0000-4000-8000-000000000099',current_setting('hiring.verification')::uuid,1,'approved','Independently reviewed business hiring authority');
select set_config('hiring.job',public.save_recruiter_job(current_setting('hiring.recruiter')::uuid,current_setting('hiring.company')::uuid,null,0,'{"title":"Engineer","description":"Build and maintain software with our experienced engineering team.","location":"India","country":"India","employment_type":"full-time","seniority":"junior","salary_currency":"INR","skills":["React"],"application_url":"https://hiring.example/apply","posting_status":"draft"}')::text,true);
do $$ begin
  begin perform public.submit_employer_application(current_setting('hiring.candidate')::uuid,current_setting('hiring.job')::uuid,'00000000-0000-4000-8000-000000000088','',false);raise exception 'Draft accepted application';exception when raise_exception then if sqlerrm<>'job_unavailable' then raise;end if;end;
end $$;
select public.save_recruiter_job(current_setting('hiring.recruiter')::uuid,current_setting('hiring.company')::uuid,current_setting('hiring.job')::uuid,1,(select to_jsonb(j)||'{"posting_status":"published"}' from public.jobs j where id=current_setting('hiring.job')::uuid));
do $$ begin
  begin perform public.submit_employer_application(current_setting('hiring.candidate')::uuid,current_setting('hiring.job')::uuid,'00000000-0000-4000-8000-000000000089','',false);raise exception 'Foreign resume submitted';exception when raise_exception then if sqlerrm<>'invalid_application' then raise;end if;end;
  if public.get_recruiter_candidate_profile(current_setting('hiring.recruiter')::uuid,current_setting('hiring.candidate')::uuid) is not null then raise exception 'Default-private candidate leaked';end if;
end $$;
select public.set_candidate_visibility(current_setting('hiring.candidate')::uuid,0,true,false,null);
do $$ declare p jsonb:=public.get_recruiter_candidate_profile(current_setting('hiring.recruiter')::uuid,current_setting('hiring.candidate')::uuid);begin
  if p->>'full_name'<>'Candidate Fixture' or p->>'contact_email' is not null or p->>'resume_text' is not null then raise exception 'Profile privacy choices ignored';end if;
  begin perform public.set_candidate_visibility(current_setting('hiring.candidate')::uuid,0,true,true,null);raise exception 'Stale privacy overwrite';exception when raise_exception then if sqlerrm<>'visibility_conflict' then raise;end if;end;
  begin perform public.set_candidate_visibility(current_setting('hiring.candidate')::uuid,1,true,true,'00000000-0000-4000-8000-000000000089');raise exception 'Foreign resume shared';exception when raise_exception then if sqlerrm<>'invalid_visibility' then raise;end if;end;
end $$;
select public.set_candidate_visibility(current_setting('hiring.candidate')::uuid,1,true,true,'00000000-0000-4000-8000-000000000088');
do $$ declare p jsonb:=public.get_recruiter_candidate_profile(current_setting('hiring.recruiter')::uuid,current_setting('hiring.candidate')::uuid);begin
 if p->>'contact_email' is null or p->>'resume_text'<>'Reviewed resume text' then raise exception 'Explicit optional sharing failed';end if;
end $$;
select public.set_candidate_visibility(current_setting('hiring.candidate')::uuid,2,false,false,null);
do $$ begin if public.get_recruiter_candidate_profile(current_setting('hiring.recruiter')::uuid,current_setting('hiring.candidate')::uuid) is not null then raise exception 'Profile consent revocation did not work';end if;end $$;
select public.set_candidate_visibility(current_setting('hiring.candidate')::uuid,3,true,true,'00000000-0000-4000-8000-000000000088',true);
do $$ declare p jsonb:=public.get_recruiter_candidate_profile(current_setting('hiring.recruiter')::uuid,current_setting('hiring.candidate')::uuid);begin
 if p->>'full_name'<>'Anonymous candidate' or p->>'contact_email' is not null or p->>'resume_text' is not null then raise exception 'Anonymous profile leaked identity';end if;
 begin perform public.submit_employer_application(current_setting('hiring.candidate')::uuid,current_setting('hiring.job')::uuid,'00000000-0000-4000-8000-000000000088','',false,'{"resume_updated_at":"2000-01-01","profile_updated_at":"2000-01-01","job_version":1,"match_score":100}');raise exception 'Stale review accepted';exception when raise_exception then if sqlerrm<>'application_preview_changed' then raise;end if;end;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='employer_applications') then raise exception 'Realtime publication absent';end if;
end $$;
select public.set_candidate_visibility(current_setting('hiring.candidate')::uuid,4,false,false,null);
select set_config('hiring.application',public.submit_employer_application(current_setting('hiring.candidate')::uuid,current_setting('hiring.job')::uuid,'00000000-0000-4000-8000-000000000088','Reviewed cover note',false,jsonb_build_object('resume_updated_at',(select updated_at from public.resumes where id='00000000-0000-4000-8000-000000000088'),'profile_updated_at',(select updated_at from public.profiles where id=current_setting('hiring.candidate')::uuid),'job_version',(select version from public.jobs where id=current_setting('hiring.job')::uuid),'match_score',70))::text,true);
do $$ declare duplicate uuid; d jsonb;begin
  duplicate:=public.submit_employer_application(current_setting('hiring.candidate')::uuid,current_setting('hiring.job')::uuid,'00000000-0000-4000-8000-000000000088','Changed retry',true);
  if duplicate<>current_setting('hiring.application')::uuid or (select count(*) from public.employer_application_events where application_id=duplicate)<>1 then raise exception 'Duplicate submission was not idempotent';end if;
  if jsonb_array_length(public.get_recruiter_applications(current_setting('hiring.recruiter')::uuid,null,null,null,0,71)->'applications')<>0 or jsonb_array_length(public.get_recruiter_applications(current_setting('hiring.recruiter')::uuid,null,null,null,0,70)->'applications')<>1 then raise exception 'Match score filter ignored';end if;
  d:=public.get_recruiter_application(current_setting('hiring.recruiter')::uuid,duplicate);
  if d->>'resume_text'<>'Reviewed resume text' or d->>'contact_email' is not null or d->>'cover_note'<>'Reviewed cover note' or d ? 'notes' or d ? 'file_path' then raise exception 'Submission snapshot leaked private data or changed on retry';end if;
  if public.get_recruiter_application('00000000-0000-4000-8000-000000000099',duplicate) is not null then raise exception 'Unrelated admin received recruiter submission';end if;
  begin perform public.update_employer_application('00000000-0000-4000-8000-000000000099',duplicate,1,'interview',true,'Forged review',false);raise exception 'Foreign recruiter changed applicant';exception when raise_exception then if sqlerrm<>'application_unavailable' then raise;end if;end;
end $$;
reset role;set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('hiring.recruiter'),'role','authenticated')::text,true);
do $$ begin
  if exists(select 1 from public.employer_applications where id=current_setting('hiring.application')::uuid) or exists(select 1 from public.candidate_visibility where user_id=current_setting('hiring.candidate')::uuid) then raise exception 'Browser recruiter read private candidate table';end if;
  begin update public.employer_applications set status='offer';raise exception 'Browser forged status';exception when insufficient_privilege then null;end;
  begin perform public.submit_employer_application(auth.uid(),current_setting('hiring.job')::uuid,null,'',false);raise exception 'Browser called privileged submit';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('hiring.candidate'),'role','authenticated')::text,true);
do $$ begin if not exists(select 1 from public.employer_applications where id=current_setting('hiring.application')::uuid) then raise exception 'Candidate cannot read own application';end if;end $$;
reset role;set local role service_role;
update public.resumes set raw_text='Edited after submission' where id='00000000-0000-4000-8000-000000000088';
do $$ begin
 if (public.get_recruiter_application(current_setting('hiring.recruiter')::uuid,current_setting('hiring.application')::uuid)->>'resume_text')<>'Reviewed resume text' then raise exception 'Submitted snapshot changed when private resume edited';end if;
 begin perform public.update_employer_application(current_setting('hiring.recruiter')::uuid,current_setting('hiring.application')::uuid,1,'withdrawn',false,'Forged withdrawal',true);raise exception 'Recruiter withdrew candidate application';exception when raise_exception then if sqlerrm<>'application_unavailable' then raise;end if;end;
 begin perform public.update_employer_application(current_setting('hiring.recruiter')::uuid,current_setting('hiring.application')::uuid,null,'screening',true,'Null version',false);raise exception 'Null version accepted';exception when raise_exception then if sqlerrm<>'application_conflict' then raise;end if;end;
end $$;
select public.update_employer_application(current_setting('hiring.recruiter')::uuid,current_setting('hiring.application')::uuid,1,'screening' ,true,'Screening your submitted resume',false);
do $$ declare data jsonb:=public.get_recruiter_applications(current_setting('hiring.recruiter')::uuid,null,'screening',true,0);begin
  if jsonb_array_length(data->'applications')<>1 or data->'counts'->>'screening'<>'1' or (data->'applications'->0) ? 'resume_text' then raise exception 'Pipeline filters/counts or lean list incorrect';end if;
  begin perform public.update_employer_application(current_setting('hiring.recruiter')::uuid,current_setting('hiring.application')::uuid,1,'interview',true,'Stale',false);raise exception 'Stale review accepted';exception when raise_exception then if sqlerrm<>'application_conflict' then raise;end if;end;
  begin perform public.update_employer_application(current_setting('hiring.recruiter')::uuid,current_setting('hiring.application')::uuid,2,'applied',true,'Backward',false);raise exception 'Backward stage accepted';exception when raise_exception then if sqlerrm<>'invalid_transition' then raise;end if;end;
end $$;
insert into public.employer_application_events(application_id,user_id,actor,status,shortlisted,note)
 select current_setting('hiring.application')::uuid,current_setting('hiring.candidate')::uuid,'Verified recruiter','screening',true,'Quota fixture' from generate_series(1,99);
do $$ begin
 begin perform public.update_employer_application(current_setting('hiring.recruiter')::uuid,current_setting('hiring.application')::uuid,2,'interview',true,'Over quota',false);raise exception 'Recruiter update quota bypassed';exception when raise_exception then if sqlerrm<>'review_limit' then raise;end if;end;
end $$;
select public.update_employer_application(current_setting('hiring.candidate')::uuid,current_setting('hiring.application')::uuid,2,'withdrawn' ,false,'Withdrawn by candidate',true);
do $$ declare data jsonb:=public.get_recruiter_application(current_setting('hiring.recruiter')::uuid,current_setting('hiring.application')::uuid);begin
  if data->>'resume_text'<>'' or data->>'contact_email' is not null or data->>'cover_note'<>'' or data->>'status'<>'withdrawn' then raise exception 'Withdrawal retained shared contents';end if;
  begin perform public.update_employer_application(current_setting('hiring.recruiter')::uuid,current_setting('hiring.application')::uuid,3,'interview',true,'Reopen',false);raise exception 'Withdrawn application reopened';exception when raise_exception then if sqlerrm<>'invalid_transition' then raise;end if;end;
end $$;
select public.review_company_verification('00000000-0000-4000-8000-000000000099',current_setting('hiring.verification')::uuid,2,'revoked','Hiring authority revoked after independent review');
do $$ begin if public.get_recruiter_application(current_setting('hiring.recruiter')::uuid,current_setting('hiring.application')::uuid) is not null then raise exception 'Revoked recruiter retained access';end if;end $$;
reset role;
delete from auth.users where id=current_setting('hiring.recruiter')::uuid;
do $$ begin if not exists(select 1 from public.employer_applications where id=current_setting('hiring.application')::uuid and company_id is null) then raise exception 'Employer deletion erased candidate submission history';end if;end $$;
delete from auth.users where id=current_setting('hiring.candidate')::uuid;
do $$ begin if exists(select 1 from public.employer_applications where id=current_setting('hiring.application')::uuid) or exists(select 1 from public.employer_application_events where application_id=current_setting('hiring.application')::uuid) then raise exception 'Candidate personal records did not cascade';end if;end $$;
select pass('Hiring workflow protects consent, snapshots, ownership, idempotency, privacy, stale writes, terminal stages, withdrawal and deletion');
select * from finish();rollback;
