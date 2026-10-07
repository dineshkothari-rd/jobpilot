create table public.launch_plans (
 id text primary key check(id in ('candidate_pro','recruiter_starter','recruiter_growth','recruiter_enterprise')),
 name text not null, audience text not null check(audience in ('candidate','recruiter')),
 autopilot integer not null check(autopilot between 1 and 1000),candidate_search integer not null check(candidate_search between 1 and 1000),interview_ai integer not null check(interview_ai between 1 and 1000),active_postings integer not null check(active_postings between 1 and 1000)
);
insert into public.launch_plans values ('candidate_pro','Candidate Pro','candidate',20,50,200,100),('recruiter_starter','Recruiter Starter','recruiter',5,100,100,100),('recruiter_growth','Recruiter Growth','recruiter',5,200,100,200),('recruiter_enterprise','Recruiter Enterprise','recruiter',5,500,100,500);
create table public.launch_plan_assignments (
 user_id uuid primary key references auth.users(id) on delete cascade,
 plan_id text not null references public.launch_plans(id),expires_at timestamptz not null,updated_at timestamptz not null default now()
);
alter table public.launch_plans enable row level security;
alter table public.launch_plan_assignments enable row level security;
revoke all on public.launch_plans,public.launch_plan_assignments from public,anon,authenticated;
grant select on public.launch_plans to anon,authenticated;
grant select on public.launch_plan_assignments to authenticated;
grant select,insert,update,delete on public.launch_plans,public.launch_plan_assignments to service_role;
create policy launch_plans_read on public.launch_plans for select to anon,authenticated using(true);
create policy assignments_read on public.launch_plan_assignments for select to authenticated using(user_id=(select auth.uid()));
create policy active_account_required on public.launch_plan_assignments as restrictive for all to authenticated using((select jobpilot_private.current_account_is_active())) with check((select jobpilot_private.current_account_is_active()));
create function public.effective_launch_plan(p_user uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if not jobpilot_private.account_is_active(p_user) or not exists(select 1 from public.profiles where id=p_user) or exists(select 1 from public.account_deletion_requests where user_id=p_user) then raise exception 'account_unavailable';end if;
 select jsonb_build_object('id',p.id,'name',p.name,'expires_at',a.expires_at,'limits',jsonb_build_object('autopilot',p.autopilot,'candidate_search',p.candidate_search,'interview_ai',p.interview_ai,'active_postings',p.active_postings)) into result
 from public.launch_plan_assignments a join public.launch_plans p on p.id=a.plan_id where a.user_id=p_user and a.expires_at>now() and (p.audience='candidate' or exists(select 1 from public.recruiter_companies where user_id=p_user and verification_status='verified'));
 if result is null then select jsonb_build_object('id','free_launch','name','Free launch','expires_at',null,'limits',jsonb_object_agg(meter,limit_value)) into result from public.launch_limits;end if;
 return result;
end $$;
revoke all on function public.effective_launch_plan(uuid) from public,anon,authenticated;
grant execute on function public.effective_launch_plan(uuid) to service_role;
create function public.assign_launch_plan(p_actor uuid,p_user uuid,p_expected text,p_plan text,p_days integer,p_reason text) returns boolean language plpgsql security invoker set search_path='' as $$
declare prior text;
begin
 if p_actor=p_user or p_actor is null or p_user is null then raise exception 'self_plan_change';end if;
 if p_reason is null or length(trim(p_reason)) not between 10 and 1000 or p_days is null or p_days not between 1 and 90 or p_expected is null then raise exception 'invalid_plan';end if;
 perform pg_catalog.pg_advisory_xact_lock(734112309::bigint);
 if not exists(select 1 from jobpilot_private.recruiter_identity(p_actor) where is_admin) or not jobpilot_private.account_is_active(p_actor) or exists(select 1 from public.account_deletion_requests where user_id=p_actor) then raise exception 'admin_required';end if;
 select public.effective_launch_plan(p_user)->>'id' into prior;
 if prior is distinct from p_expected then raise exception 'plan_conflict';end if;
 if p_plan is null or p_plan<>'free_launch' and not exists(select 1 from public.launch_plans where id=p_plan and (audience='candidate' or exists(select 1 from public.recruiter_companies where user_id=p_user and verification_status='verified'))) then raise exception 'invalid_plan';end if;
 if p_plan='free_launch' then delete from public.launch_plan_assignments where user_id=p_user;
 else insert into public.launch_plan_assignments(user_id,plan_id,expires_at) values(p_user,p_plan,now()+p_days*interval '1 day') on conflict(user_id) do update set plan_id=excluded.plan_id,expires_at=excluded.expires_at,updated_at=now();end if;
 insert into public.admin_operation_events(actor_id,user_id,status,reason) values(p_actor,p_user,'plan_assigned:'||p_plan,trim(p_reason));
 return true;
end $$;
revoke all on function public.assign_launch_plan(uuid,uuid,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.assign_launch_plan(uuid,uuid,text,text,integer,text) to service_role;

create or replace function public.consume_launch_allowance(p_user uuid,p_meter text) returns integer language plpgsql security invoker set search_path='' as $$
declare quota integer; result integer; today date:=(now() at time zone 'UTC')::date;
begin
 if not jobpilot_private.account_is_active(p_user) then raise exception 'account_suspended';end if;
 if not exists(select 1 from public.profiles where id=p_user) or exists(select 1 from public.account_deletion_requests where user_id=p_user) then raise exception 'account_unavailable';end if;
 if p_meter not in ('autopilot','candidate_search','interview_ai') then raise exception 'invalid_allowance';end if;
 select (public.effective_launch_plan(p_user)->'limits'->>p_meter)::integer into quota;
 if quota is null then raise exception 'invalid_allowance';end if;
 if p_meter='candidate_search' and not exists(select 1 from public.recruiter_companies where user_id=p_user and verification_status='verified') then raise exception 'company_not_verified';end if;
 insert into public.launch_usage as u(user_id,usage_day,meter,used) values(p_user,today,p_meter,1)
 on conflict(user_id,usage_day,meter) do update set used=u.used+1 where u.used<quota returning used into result;
 if result is null then raise exception 'allowance_exhausted';end if;
 -- ponytail: retain 35 days of usage per account; add billing-period retention only with paid plans.
 delete from public.launch_usage where user_id=p_user and usage_day<today-35;
 return result;
end $$;

create or replace function public.get_launch_usage(p_user uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; company uuid; plan jsonb;
begin
 plan:=public.effective_launch_plan(p_user);
 if not exists(select 1 from public.profiles where id=p_user) or exists(select 1 from public.account_deletion_requests where user_id=p_user) then raise exception 'account_unavailable';end if;
 select id into company from public.recruiter_companies where user_id=p_user;
 select jsonb_agg(jsonb_build_object('meter',l.meter,'limit',(plan->'limits'->>l.meter)::integer,'period',l.period,'used',
  case when l.meter='active_postings' then (select count(*) from public.jobs where recruiter_company_id=company and posting_status<>'closed') else coalesce(u.used,0) end) order by l.meter)
 into result from public.launch_limits l left join public.launch_usage u on u.meter=l.meter and u.user_id=p_user and u.usage_day=(now() at time zone 'UTC')::date;
 return jsonb_build_object('plan',plan->>'id','plan_name',plan->>'name','expires_at',plan->'expires_at','recruiter',company is not null,'allowances',result,'resets_at',(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')+interval '1 day');
end $$;

create or replace function public.save_recruiter_job(p_user uuid,p_company uuid,p_job uuid,p_version integer,p_fields jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare c public.recruiter_companies; j public.jobs; target uuid:=coalesce(p_job,gen_random_uuid()); next_status text:=p_fields->>'posting_status'; posting_limit integer;
begin
  select * into c from public.recruiter_companies where id=p_company and user_id=p_user for update;
  if c.id is null or exists(select 1 from public.account_deletion_requests where user_id=p_user) then raise exception 'recruiter_required';end if;
  if next_status='published' and c.verification_status<>'verified' then raise exception 'company_not_verified';end if;
  if p_job is not null then
    select * into j from public.jobs where id=p_job and recruiter_company_id=c.id and source='jobpilot' for update;
    if j.id is null or j.version is distinct from p_version then raise exception 'posting_conflict';end if;
    if j.posting_status='closed' and next_status<>'closed' then raise exception 'posting_closed';end if;
  else
    if p_version is distinct from 0 or next_status<>'draft' then raise exception 'draft_required';end if;
    select (public.effective_launch_plan(p_user)->'limits'->>'active_postings')::integer into posting_limit;
    if posting_limit is null then raise exception 'allowance_unavailable';end if;
    if (select count(*) from public.jobs where recruiter_company_id=c.id and posting_status<>'closed')>=posting_limit then raise exception 'posting_limit';end if;
  end if;
  insert into public.jobs(id,external_id,source,recruiter_company_id,company_name,title,description,location,country,employment_type,seniority,salary_min,salary_max,salary_currency,skills,application_url,posting_status,equity_min,equity_max,published_at,expires_at)
  values(target,'jobpilot:'||target,'jobpilot',c.id,c.name,p_fields->>'title',p_fields->>'description',p_fields->>'location',p_fields->>'country',p_fields->>'employment_type',p_fields->>'seniority',nullif(p_fields->>'salary_min','')::integer,nullif(p_fields->>'salary_max','')::integer,p_fields->>'salary_currency',array(select jsonb_array_elements_text(p_fields->'skills')),p_fields->>'application_url',next_status,nullif(p_fields->>'equity_min','')::numeric,nullif(p_fields->>'equity_max','')::numeric,case when next_status='published' then coalesce(j.published_at,now()) else j.published_at end,case when next_status in ('closed','paused') then now() else null end)
  on conflict(id) do update set title=excluded.title,description=excluded.description,location=excluded.location,country=excluded.country,employment_type=excluded.employment_type,seniority=excluded.seniority,salary_min=excluded.salary_min,salary_max=excluded.salary_max,salary_currency=excluded.salary_currency,skills=excluded.skills,application_url=excluded.application_url,posting_status=excluded.posting_status,equity_min=excluded.equity_min,equity_max=excluded.equity_max,published_at=excluded.published_at,expires_at=excluded.expires_at,version=public.jobs.version+1;
  if next_status='published' and j.published_at is null then update public.jobs set alert_available_at=now() where id=target;end if;
  return target;
end $$;
