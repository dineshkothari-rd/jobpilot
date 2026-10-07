begin;
select plan(1);
select set_config('hiring.candidate','00000000-0000-4000-8000-000000000010',true);
select set_config('hiring.recruiter','00000000-0000-4000-8000-000000000001',true);
insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values('00000000-0000-4000-8000-000000000099','authenticated','authenticated','admin@fixture.invalid',now(),'{"role":"admin"}','{}'),('00000000-0000-4000-8000-000000000098','authenticated','authenticated','foreign@fixture.invalid',now(),'{}','{}');
update auth.users set email_confirmed_at=now() where id in(current_setting('hiring.candidate')::uuid,current_setting('hiring.recruiter')::uuid);
update public.profiles set full_name='Candidate Fixture',target_role='Engineer',location='India',experience_years=4 where id=current_setting('hiring.candidate')::uuid;
insert into public.resumes(id,user_id,file_name,raw_text,parsed_data) values('00000000-0000-4000-8000-000000000088',current_setting('hiring.candidate')::uuid,'selected.txt','Reviewed resume text','{"skills":{"frontend":["React"]}}');
set local role service_role;
select set_config('hiring.company',public.register_recruiter(current_setting('hiring.recruiter')::uuid,'Hiring Fixture','hiring.example','Fixture Recruiter','https://hiring.example','https://hiring.example/proof','Hiring authority verified by independent administrator')::text,true);
select set_config('hiring.verification',(select id::text from public.company_verification_requests where company_id=current_setting('hiring.company')::uuid),true);
select public.review_company_verification('00000000-0000-4000-8000-000000000099',current_setting('hiring.verification')::uuid,1,'approved','Independently reviewed business hiring authority');
select set_config('hiring.job',public.save_recruiter_job(current_setting('hiring.recruiter')::uuid,current_setting('hiring.company')::uuid,null,0,'{"title":"Engineer","description":"Build and maintain software with our experienced engineering team.","location":"India","country":"India","employment_type":"full-time","seniority":"junior","salary_currency":"INR","skills":["React"],"application_url":"https://hiring.example/apply","posting_status":"draft"}')::text,true);
select public.save_recruiter_job(current_setting('hiring.recruiter')::uuid,current_setting('hiring.company')::uuid,current_setting('hiring.job')::uuid,1,(select to_jsonb(j)||'{"posting_status":"published"}' from public.jobs j where id=current_setting('hiring.job')::uuid));
do $$ begin
 begin perform public.get_admin_operations(current_setting('hiring.candidate')::uuid,0,null);raise exception 'Candidate admin bypass';exception when raise_exception then if sqlerrm<>'application_unavailable' then raise;end if;end;
 if public.get_employer_branding(current_setting('hiring.company')::uuid) is not null then raise exception 'Unpublished branding visible';end if;
end $$;
select public.save_employer_branding(current_setting('hiring.recruiter')::uuid,0,'{"tagline":"Work with us","about":"Build practical products","culture":"Collaborative culture","perks":["Flexible work"],"tech_stack":["React"],"leadership":[{"name":"Founder","role":"CEO"}],"banner_style":"blue","published":true}');
do $$ declare branding jsonb:=public.get_employer_branding(current_setting('hiring.company')::uuid);begin
 if branding->>'tagline'<>'Work with us' or branding ? 'user_id' or branding ? 'contact_email' then raise exception 'Public branding scope failed';end if;
 begin perform public.save_employer_branding(current_setting('hiring.recruiter')::uuid,0,'{}');raise exception 'Stale branding accepted';exception when raise_exception then if sqlerrm<>'application_conflict' then raise;end if;end;
end $$;
select public.save_admin_account_case('00000000-0000-4000-8000-000000000099',current_setting('hiring.candidate')::uuid,0,'review_needed','Private account support case');
do $$ declare data jsonb:=public.get_admin_operations('00000000-0000-4000-8000-000000000099',0,'Candidate Fixture');begin
 if jsonb_array_length(data->'accounts')<>1 or data->'accounts'->0->>'case_status'<>'review_needed' then raise exception 'Admin directory/case mismatch';end if;
 begin perform public.save_admin_account_case(current_setting('hiring.recruiter')::uuid,current_setting('hiring.candidate')::uuid,1,'clear','Forged admin');raise exception 'Recruiter modified admin case';exception when raise_exception then if sqlerrm<>'application_unavailable' then raise;end if;end;
 begin perform public.save_admin_account_case('00000000-0000-4000-8000-000000000099',current_setting('hiring.candidate')::uuid,0,'clear','Stale admin');raise exception 'Stale admin case accepted';exception when raise_exception then if sqlerrm<>'application_conflict' then raise;end if;end;
 if (select count(*) from public.admin_operation_events)<>1 then raise exception 'Admin case audit missing';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('hiring.candidate'),'role','authenticated')::text,true);
do $$ begin
 if exists(select 1 from public.employer_branding) then raise exception 'Candidate raw branding access';end if;
 begin perform 1 from public.admin_account_cases;raise exception 'Private admin notes exposed';exception when insufficient_privilege then null;end;
 begin perform public.get_admin_operations('00000000-0000-4000-8000-000000000099',0,null);raise exception 'Browser admin RPC impersonation';exception when insufficient_privilege then null;end;
end $$;
set local role service_role;
select public.review_company_verification('00000000-0000-4000-8000-000000000099',current_setting('hiring.verification')::uuid,2,'revoked','Hiring authority revoked after independent review');
do $$ begin if public.get_employer_branding(current_setting('hiring.company')::uuid) is not null then raise exception 'Revoked branding remains visible';end if;end $$;
reset role;
delete from auth.users where id=current_setting('hiring.candidate')::uuid;
do $$ begin if exists(select 1 from public.admin_account_cases) or exists(select 1 from public.admin_operation_events) then raise exception 'Candidate deletion retained private account case';end if;end $$;
select pass('Verified-owned branding, immutable admin audit, trusted role gates, stale writes and deletion');
select * from finish();
rollback;
