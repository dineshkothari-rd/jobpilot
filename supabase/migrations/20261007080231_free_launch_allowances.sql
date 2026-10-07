create table public.launch_limits (
  meter text primary key check(meter in ('autopilot','candidate_search','interview_ai','active_postings')),
  limit_value integer not null check(limit_value between 1 and 10000),
  period text not null check(period in ('utc_day','active'))
);
insert into public.launch_limits values ('autopilot',5,'utc_day'),('candidate_search',50,'utc_day'),('interview_ai',100,'utc_day'),('active_postings',100,'active');
create table public.launch_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null,
  meter text not null references public.launch_limits(meter),
  used integer not null check(used>0),
  primary key(user_id,usage_day,meter)
);
alter table public.launch_limits enable row level security;
alter table public.launch_usage enable row level security;
revoke all on public.launch_limits,public.launch_usage from public,anon,authenticated;
grant select on public.launch_limits to anon,authenticated;
grant select on public.launch_usage to authenticated;
grant select,insert,update,delete on public.launch_limits,public.launch_usage to service_role;
create policy launch_limits_read on public.launch_limits for select to anon,authenticated using(true);
create policy launch_usage_owner on public.launch_usage for select to authenticated using(user_id=(select auth.uid()));
create function public.consume_launch_allowance(p_user uuid,p_meter text) returns integer language plpgsql security invoker set search_path='' as $$
declare quota integer; result integer; today date:=(now() at time zone 'UTC')::date;
begin
 if not exists(select 1 from public.profiles where id=p_user) or exists(select 1 from public.account_deletion_requests where user_id=p_user) then raise exception 'account_unavailable';end if;
 select limit_value into quota from public.launch_limits where meter=p_meter and period='utc_day';
 if quota is null then raise exception 'invalid_allowance';end if;
 if p_meter='candidate_search' and not exists(select 1 from public.recruiter_companies where user_id=p_user and verification_status='verified') then raise exception 'company_not_verified';end if;
 insert into public.launch_usage as u(user_id,usage_day,meter,used) values(p_user,today,p_meter,1)
 on conflict(user_id,usage_day,meter) do update set used=u.used+1 where u.used<quota returning used into result;
 if result is null then raise exception 'allowance_exhausted';end if;
 -- ponytail: retain 35 days of usage per account; add billing-period retention only with paid plans.
 delete from public.launch_usage where user_id=p_user and usage_day<today-35;
 return result;
end $$;
create function public.get_launch_usage(p_user uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; company uuid;
begin
 if not exists(select 1 from public.profiles where id=p_user) or exists(select 1 from public.account_deletion_requests where user_id=p_user) then raise exception 'account_unavailable';end if;
 select id into company from public.recruiter_companies where user_id=p_user;
 select jsonb_agg(jsonb_build_object('meter',l.meter,'limit',l.limit_value,'period',l.period,'used',
  case when l.meter='active_postings' then (select count(*) from public.jobs where recruiter_company_id=company and posting_status<>'closed') else coalesce(u.used,0) end) order by l.meter)
 into result from public.launch_limits l left join public.launch_usage u on u.meter=l.meter and u.user_id=p_user and u.usage_day=(now() at time zone 'UTC')::date;
 return jsonb_build_object('plan','free_launch','recruiter',company is not null,'allowances',result,'resets_at',(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')+interval '1 day');
end $$;
revoke all on function public.consume_launch_allowance(uuid,text),public.get_launch_usage(uuid) from public,anon,authenticated;
grant execute on function public.consume_launch_allowance(uuid,text),public.get_launch_usage(uuid) to service_role;

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
    select limit_value into posting_limit from public.launch_limits where meter='active_postings';
    if posting_limit is null then raise exception 'allowance_unavailable';end if;
    if (select count(*) from public.jobs where recruiter_company_id=c.id and posting_status<>'closed')>=posting_limit then raise exception 'posting_limit';end if;
  end if;
  insert into public.jobs(id,external_id,source,recruiter_company_id,company_name,title,description,location,country,employment_type,seniority,salary_min,salary_max,salary_currency,skills,application_url,posting_status,equity_min,equity_max,published_at,expires_at)
  values(target,'jobpilot:'||target,'jobpilot',c.id,c.name,p_fields->>'title',p_fields->>'description',p_fields->>'location',p_fields->>'country',p_fields->>'employment_type',p_fields->>'seniority',nullif(p_fields->>'salary_min','')::integer,nullif(p_fields->>'salary_max','')::integer,p_fields->>'salary_currency',array(select jsonb_array_elements_text(p_fields->'skills')),p_fields->>'application_url',next_status,nullif(p_fields->>'equity_min','')::numeric,nullif(p_fields->>'equity_max','')::numeric,case when next_status='published' then coalesce(j.published_at,now()) else j.published_at end,case when next_status in ('closed','paused') then now() else null end)
  on conflict(id) do update set title=excluded.title,description=excluded.description,location=excluded.location,country=excluded.country,employment_type=excluded.employment_type,seniority=excluded.seniority,salary_min=excluded.salary_min,salary_max=excluded.salary_max,salary_currency=excluded.salary_currency,skills=excluded.skills,application_url=excluded.application_url,posting_status=excluded.posting_status,equity_min=excluded.equity_min,equity_max=excluded.equity_max,published_at=excluded.published_at,expires_at=excluded.expires_at,version=public.jobs.version+1;
  if next_status='published' and j.published_at is null then update public.jobs set alert_available_at=now() where id=target;end if;
  return target;
end $$;
