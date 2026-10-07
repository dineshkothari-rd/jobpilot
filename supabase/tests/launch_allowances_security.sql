begin;
select plan(1);
select set_config('jobpilot.test.owner',(select id::text from auth.users order by created_at limit 1),true);
select set_config('jobpilot.test.other',(select id::text from auth.users order by created_at limit 1 offset 1),true);
set local role service_role;
do $$ declare owner uuid:=current_setting('jobpilot.test.owner')::uuid; snapshot jsonb;
begin
 update public.launch_limits set limit_value=2 where meter='interview_ai';
 if public.consume_launch_allowance(owner,'interview_ai')<>1 or public.consume_launch_allowance(owner,'interview_ai')<>2 then raise exception 'Usage not atomic';end if;
 begin perform public.consume_launch_allowance(owner,'interview_ai');raise exception 'Quota bypass';exception when raise_exception then if sqlerrm<>'allowance_exhausted' then raise;end if;end;
 begin perform public.consume_launch_allowance(owner,'paid_credit');raise exception 'Unknown plan allowance accepted';exception when raise_exception then if sqlerrm<>'invalid_allowance' then raise;end if;end;
 begin perform public.consume_launch_allowance(owner,'candidate_search');raise exception 'Unverified recruiter consumed search';exception when raise_exception then if sqlerrm<>'company_not_verified' then raise;end if;end;
 snapshot:=public.get_launch_usage(owner);
 if snapshot->>'plan'<>'free_launch' or not exists(select 1 from jsonb_array_elements(snapshot->'allowances') r where r->>'meter'='interview_ai' and (r->>'used')::integer=2 and (r->>'limit')::integer=2) then raise exception 'Usage snapshot incorrect';end if;
 if (snapshot->>'resets_at')::timestamptz<=now() then raise exception 'Wrong reset instant';end if;
 insert into public.launch_usage(user_id,usage_day,meter,used) values(owner,(now() at time zone 'UTC')::date-40,'autopilot',1);
 perform public.consume_launch_allowance(owner,'autopilot');
 if exists(select 1 from public.launch_usage where user_id=owner and usage_day<(now() at time zone 'UTC')::date-35) then raise exception 'Usage retention unbounded';end if;
 insert into public.account_deletion_requests(user_id) values(owner);
 begin perform public.consume_launch_allowance(owner,'autopilot');raise exception 'Deleting account admitted';exception when raise_exception then if sqlerrm<>'account_unavailable' then raise;end if;end;
 delete from public.account_deletion_requests where user_id=owner;
end $$;
set local role anon;
do $$ begin
 if (select count(*) from public.launch_limits)<>4 then raise exception 'Public plan limits missing';end if;
 begin perform 1 from public.launch_usage;raise exception 'Anonymous usage visible';exception when insufficient_privilege then null;end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('jobpilot.test.other'),'role','authenticated','app_metadata',json_build_object('plan','paid'))::text,true);
do $$ begin
 if exists(select 1 from public.launch_usage where user_id=current_setting('jobpilot.test.owner')::uuid) then raise exception 'Foreign allowance visible';end if;
 begin perform public.consume_launch_allowance(auth.uid(),'interview_ai');raise exception 'Browser consumption allowed';exception when insufficient_privilege then null;end;
 begin update public.launch_limits set limit_value=999;raise exception 'Browser plan upgrade allowed';exception when insufficient_privilege then null;end;
end $$;
select pass('Free allowances are bounded, service-only, owner-private, reset-aware and ignore forged paid claims');
select * from finish();
rollback;
