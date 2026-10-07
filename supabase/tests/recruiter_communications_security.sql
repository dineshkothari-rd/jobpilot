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
 if jsonb_array_length(public.search_hiring_candidates(current_setting('hiring.recruiter')::uuid,null,null,null,null,0,false))<>0 then raise exception 'Private candidate searchable';end if;
 begin perform public.open_hiring_thread(current_setting('hiring.recruiter')::uuid,current_setting('hiring.candidate')::uuid);raise exception 'Private candidate contact allowed';exception when raise_exception then if sqlerrm<>'application_unavailable' then raise;end if;end;
end $$;
select public.set_candidate_visibility(current_setting('hiring.candidate')::uuid,0,true,false,'00000000-0000-4000-8000-000000000088');
do $$ declare rows jsonb;begin
 rows:=public.search_hiring_candidates(current_setting('hiring.recruiter')::uuid,'engineer','India','React',3,0,false);
 if jsonb_array_length(rows)<>1 or rows->0 ? 'resume_text' or rows->0 ? 'contact_email' then raise exception 'Talent filter/private data boundary failed';end if;
 if jsonb_array_length(public.search_hiring_candidates(current_setting('hiring.recruiter')::uuid,null,null,'missing',null,0,false))<>0 then raise exception 'Skill filter ignored';end if;
end $$;
select public.save_recruiter_shortlist(current_setting('hiring.recruiter')::uuid,current_setting('hiring.candidate')::uuid,0,'shortlist','Company private note');
do $$ begin
 begin perform public.save_recruiter_shortlist(current_setting('hiring.recruiter')::uuid,current_setting('hiring.candidate')::uuid,0,'passed','stale');raise exception 'Stale sourcing version accepted';exception when raise_exception then if sqlerrm<>'application_conflict' then raise;end if;end;
 if jsonb_array_length(public.search_hiring_candidates(current_setting('hiring.recruiter')::uuid,null,null,null,null,0,true))<>1 then raise exception 'Sourcing pipeline filter failed';end if;
end $$;
select public.record_hiring_view(current_setting('hiring.recruiter')::uuid,current_setting('hiring.candidate')::uuid,true);
select public.record_hiring_view(current_setting('hiring.recruiter')::uuid,current_setting('hiring.candidate')::uuid,true);
do $$ begin if (select count(*) from public.hiring_notifications where user_id=current_setting('hiring.candidate')::uuid)<>2 then raise exception 'View notices not deduplicated';end if;end $$;
select set_config('hiring.thread',public.open_hiring_thread(current_setting('hiring.recruiter')::uuid,current_setting('hiring.candidate')::uuid)::text,true);
select public.send_hiring_message(current_setting('hiring.recruiter')::uuid,current_setting('hiring.thread')::uuid,'00000000-0000-4000-8000-000000000077','Hello candidate');
select public.send_hiring_message(current_setting('hiring.recruiter')::uuid,current_setting('hiring.thread')::uuid,'00000000-0000-4000-8000-000000000077','Hello candidate');
select public.send_hiring_message(current_setting('hiring.candidate')::uuid,current_setting('hiring.thread')::uuid,'00000000-0000-4000-8000-000000000076','Hello recruiter');
do $$ begin
 if (select count(*) from public.hiring_messages)<>2 then raise exception 'Message retry duplicated';end if;
 begin perform public.get_hiring_thread('00000000-0000-4000-8000-000000000098',current_setting('hiring.thread')::uuid);raise exception 'Foreign thread access allowed';exception when raise_exception then if sqlerrm<>'application_unavailable' then raise;end if;end;
 if jsonb_array_length(public.get_hiring_export_rows('00000000-0000-4000-8000-000000000098','messages',0))<>0 or jsonb_array_length(public.get_hiring_export_rows(current_setting('hiring.candidate')::uuid,'messages',0))<>2 then raise exception 'Conversation export ownership failed';end if;
end $$;
select public.save_hiring_invitation(current_setting('hiring.recruiter')::uuid,'00000000-0000-4000-8000-000000000075',current_setting('hiring.thread')::uuid,current_setting('hiring.job')::uuid,0,jsonb_build_object('round','Technical','starts_at',now()+interval '2 days','timezone','UTC','duration_minutes',30,'location','Video meeting','notes','Discuss real project experience'));
do $$ begin
 begin perform public.respond_hiring_invitation('00000000-0000-4000-8000-000000000098','00000000-0000-4000-8000-000000000075',1,'accepted','');raise exception 'Foreign accepted invitation';exception when raise_exception then if sqlerrm<>'application_unavailable' then raise;end if;end;
end $$;
select public.respond_hiring_invitation(current_setting('hiring.candidate')::uuid,'00000000-0000-4000-8000-000000000075',1,'reschedule_requested','Please suggest another day in UTC');
select public.save_hiring_invitation(current_setting('hiring.recruiter')::uuid,'00000000-0000-4000-8000-000000000075',current_setting('hiring.thread')::uuid,current_setting('hiring.job')::uuid,2,jsonb_build_object('round','Technical','starts_at',now()+interval '3 days','timezone','UTC','duration_minutes',30,'location','Video meeting','notes','Discuss real project experience'));
-- An invitation must never silently reuse an unrelated private planner round.
insert into public.applications(user_id,job_id,status) values(current_setting('hiring.candidate')::uuid,current_setting('hiring.job')::uuid,'saved') on conflict(user_id,job_id) do nothing;
insert into public.application_interviews(id,user_id,application_id,round,starts_at,timezone,duration_minutes,location,notes) select '00000000-0000-4000-8000-000000000075',user_id,id,'Existing private round',now()+interval '5 days','UTC',30,'Private','Private' from public.applications where user_id=current_setting('hiring.candidate')::uuid and job_id=current_setting('hiring.job')::uuid;
do $$ begin
 begin perform public.respond_hiring_invitation(current_setting('hiring.candidate')::uuid,'00000000-0000-4000-8000-000000000075',3,'accepted','');raise exception 'Planner UUID collision accepted';exception when raise_exception then if sqlerrm<>'application_conflict' then raise;end if;end;
end $$;
delete from public.application_interviews where id='00000000-0000-4000-8000-000000000075';
select public.respond_hiring_invitation(current_setting('hiring.candidate')::uuid,'00000000-0000-4000-8000-000000000075',3,'accepted','Confirmed');
do $$ begin
 if (select count(*) from public.application_interviews where user_id=current_setting('hiring.candidate')::uuid and id='00000000-0000-4000-8000-000000000075')<>1 then raise exception 'Accepted planner round missing';end if;
 if (select status from public.applications where user_id=current_setting('hiring.candidate')::uuid and job_id=current_setting('hiring.job')::uuid)<>'saved' or exists(select 1 from public.employer_applications) then raise exception 'Invitation falsely submitted application';end if;
 begin perform public.respond_hiring_invitation(current_setting('hiring.candidate')::uuid,'00000000-0000-4000-8000-000000000075',3,'accepted','again');raise exception 'Stale invitation accepted';exception when raise_exception then if sqlerrm<>'application_conflict' then raise;end if;end;
end $$;
select public.respond_hiring_invitation(current_setting('hiring.recruiter')::uuid,'00000000-0000-4000-8000-000000000075',4,'cancelled','Cancelled with candidate notice');
do $$ begin if (select status from public.application_interviews where id='00000000-0000-4000-8000-000000000075')<>'cancelled' then raise exception 'Accepted cancellation not propagated';end if;end $$;
select public.set_hiring_thread_block(current_setting('hiring.candidate')::uuid,current_setting('hiring.thread')::uuid,true);
do $$ begin
 begin perform public.send_hiring_message(current_setting('hiring.recruiter')::uuid,current_setting('hiring.thread')::uuid,gen_random_uuid(),'Blocked contact');raise exception 'Blocked message delivered';exception when raise_exception then if sqlerrm<>'application_unavailable' then raise;end if;end;
 if (public.get_hiring_thread(current_setting('hiring.candidate')::uuid,current_setting('hiring.thread')::uuid)->>'can_send')::boolean then raise exception 'Blocked thread writable';end if;
end $$;
select public.set_hiring_thread_block(current_setting('hiring.candidate')::uuid,current_setting('hiring.thread')::uuid,false);
select public.set_candidate_visibility(current_setting('hiring.candidate')::uuid,1,false,false,null);
do $$ begin
 if (public.get_hiring_thread(current_setting('hiring.candidate')::uuid,current_setting('hiring.thread')::uuid)->>'can_send')::boolean then raise exception 'Consent revocation ignored';end if;
 begin perform public.get_hiring_thread(current_setting('hiring.recruiter')::uuid,current_setting('hiring.thread')::uuid);raise exception 'Revoked sourcing contact accessible';exception when raise_exception then if sqlerrm<>'application_unavailable' then raise;end if;end;
end $$;
select public.set_candidate_visibility(current_setting('hiring.candidate')::uuid,2,true,false,'00000000-0000-4000-8000-000000000088');
do $$ begin
 for index in 1..19 loop perform public.send_hiring_message(current_setting('hiring.recruiter')::uuid,current_setting('hiring.thread')::uuid,gen_random_uuid(),'Bounded message '||index);end loop;
 begin perform public.send_hiring_message(current_setting('hiring.recruiter')::uuid,current_setting('hiring.thread')::uuid,gen_random_uuid(),'Minute quota');raise exception 'Minute message quota bypass';exception when raise_exception then if sqlerrm<>'hiring_limit' then raise;end if;end;
end $$;
insert into public.hiring_messages(id,thread_id,sender_id,body,created_at) select gen_random_uuid(),current_setting('hiring.thread')::uuid,current_setting('hiring.recruiter')::uuid,'Earlier daily fixture',now()-interval '2 minutes' from generate_series(1,80);
do $$ begin
 begin perform public.send_hiring_message(current_setting('hiring.recruiter')::uuid,current_setting('hiring.thread')::uuid,gen_random_uuid(),'Daily quota');raise exception 'Daily message quota bypass';exception when raise_exception then if sqlerrm<>'hiring_limit' then raise;end if;end;
end $$;
insert into public.account_deletion_requests(user_id) values(current_setting('hiring.candidate')::uuid);
do $$ begin
 begin perform public.get_hiring_thread(current_setting('hiring.candidate')::uuid,current_setting('hiring.thread')::uuid);raise exception 'Deleting candidate thread accessible';exception when raise_exception then if sqlerrm<>'application_unavailable' then raise;end if;end;
end $$;
delete from public.account_deletion_requests where user_id=current_setting('hiring.candidate')::uuid;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('hiring.candidate'),'role','authenticated')::text,true);
do $$ begin
 if exists(select 1 from public.recruiter_shortlists) then raise exception 'Candidate read private recruiter notes';end if;
 if exists(select 1 from public.hiring_notifications where user_id<>current_setting('hiring.candidate')::uuid) then raise exception 'Foreign notice exposed';end if;
 begin perform public.open_hiring_thread(current_setting('hiring.recruiter')::uuid,current_setting('hiring.candidate')::uuid);raise exception 'Client RPC impersonation';exception when insufficient_privilege then null;end;
 begin perform 1 from public.hiring_messages;raise exception 'Client bypassed participant checks';exception when insufficient_privilege then null;end;
end $$;
set local role service_role;
select public.review_company_verification('00000000-0000-4000-8000-000000000099',current_setting('hiring.verification')::uuid,2,'revoked','Hiring authority revoked after independent review');
do $$ begin
 begin perform public.search_hiring_candidates(current_setting('hiring.recruiter')::uuid,null,null,null,null,0,false);raise exception 'Unverified search allowed';exception when raise_exception then if sqlerrm<>'company_not_verified' then raise;end if;end;
end $$;
reset role;
delete from auth.users where id=current_setting('hiring.candidate')::uuid;
do $$ begin if exists(select 1 from public.hiring_threads) or exists(select 1 from public.hiring_messages) or exists(select 1 from public.hiring_invitations) or exists(select 1 from public.recruiter_shortlists) then raise exception 'Candidate deletion retained personal hiring content';end if;end $$;
select pass('Opt-in search, private sourcing, consent-scoped messaging, idempotency, invitations/planner, revocation, owner export and deletion');
select * from finish();
rollback;
