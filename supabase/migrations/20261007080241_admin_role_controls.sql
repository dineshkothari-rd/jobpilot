alter table public.admin_operation_events add column reason text check(reason is null or length(reason) between 10 and 1000);
create function jobpilot_private.is_current_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u join public.profiles p on p.id=u.id
  where u.id=(select auth.uid()) and u.raw_app_meta_data->>'role'='admin'
  and not exists(select 1 from public.account_deletion_requests where user_id=u.id))
$$;
revoke all on function jobpilot_private.is_current_admin() from public,anon,authenticated;
grant usage on schema jobpilot_private to authenticated;
grant execute on function jobpilot_private.is_current_admin() to authenticated;

-- Only the trusted server can call this entry point; fresh database checks, not JWT role claims, authorize the actor.
create function jobpilot_private.set_admin_role(p_actor uuid,p_user uuid,p_expected text,p_role text,p_reason text) returns boolean language plpgsql security definer set search_path='' as $$
declare stored_role text;
begin
 if p_actor=p_user or p_actor is null or p_user is null then raise exception 'self_role_change';end if;
 if p_expected is null or p_expected not in ('member','admin') or p_role is null or p_role not in ('member','admin') or p_reason is null or length(trim(p_reason)) not between 10 and 1000 then raise exception 'invalid_role_change';end if;
 -- Serialize role changes so two admins cannot demote each other using concurrently valid privileges.
 perform pg_catalog.pg_advisory_xact_lock(734112309::bigint);
 perform 1 from auth.users where id in(p_actor,p_user) order by id for update;
 if not exists(select 1 from auth.users u join public.profiles p on p.id=u.id where u.id=p_actor and u.raw_app_meta_data->>'role'='admin' and (u.banned_until is null or u.banned_until<=now())) or exists(select 1 from public.account_deletion_requests where user_id in(p_actor,p_user)) then raise exception 'admin_required';end if;
 select case when u.raw_app_meta_data->>'role'='admin' then 'admin' else 'member' end into stored_role
 from auth.users u join public.profiles p on p.id=u.id where u.id=p_user and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now());
 if stored_role is null then raise exception 'role_target_unavailable';end if;
 if stored_role is distinct from p_expected then raise exception 'role_conflict';end if;
 if stored_role=p_role then return false;end if;
 update auth.users set raw_app_meta_data=jsonb_set(coalesce(raw_app_meta_data,'{}'::jsonb),'{role}',to_jsonb(p_role),true),updated_at=now() where id=p_user;
 insert into public.admin_operation_events(actor_id,user_id,status,reason) values(p_actor,p_user,'role_changed:'||p_role,trim(p_reason));
 return true;
end $$;
revoke all on function jobpilot_private.set_admin_role(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function jobpilot_private.set_admin_role(uuid,uuid,text,text,text) to service_role;
create function public.set_admin_role(p_actor uuid,p_user uuid,p_expected text,p_role text,p_reason text) returns boolean language sql security invoker set search_path='' as $$
 select jobpilot_private.set_admin_role(p_actor,p_user,p_expected,p_role,p_reason)
$$;
revoke all on function public.set_admin_role(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.set_admin_role(uuid,uuid,text,text,text) to service_role;

alter policy reports_read on public.job_reports using(user_id=(select auth.uid()) or (select jobpilot_private.is_current_admin()));
alter policy reports_moderate on public.job_reports using((select jobpilot_private.is_current_admin()) and status='pending')
 with check((select jobpilot_private.is_current_admin()) and status in ('confirmed','dismissed') and reviewed_by=(select auth.uid()) and reviewed_at is not null);
alter policy hidden_confirm on public.hidden_jobs with check((select jobpilot_private.is_current_admin()));
alter policy support_read on public.support_tickets using(exists(select 1 from public.profiles where id=(select auth.uid())) and (user_id=(select auth.uid()) or (select jobpilot_private.is_current_admin())));
alter policy support_reply on public.support_tickets using((select jobpilot_private.is_current_admin())) with check((select jobpilot_private.is_current_admin()));
alter policy jobs_select_visible on public.jobs using(
 ((source<>'jobpilot' and (created_by is null or created_by=(select auth.uid()))) or
 (source='jobpilot' and posting_status='published' and jobpilot_private.is_verified_company(recruiter_company_id)))
 and ((select jobpilot_private.is_current_admin()) or not exists(select 1 from public.hidden_jobs h where h.job_id=jobs.id))
);

create or replace function public.get_admin_operations(p_user uuid,p_offset integer,p_query text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare accounts jsonb; counts jsonb;
begin
  if not exists(select 1 from jobpilot_private.recruiter_identity(p_user) where is_admin) or exists(select 1 from public.account_deletion_requests where user_id=p_user) or not exists(select 1 from public.profiles where id=p_user) then raise exception 'application_unavailable';end if;
  if p_offset is null or p_offset not between 0 and 100000 or length(p_query)>200 then raise exception 'invalid_application';end if;
  select jsonb_build_object('accounts',(select count(*) from public.profiles),'verified_companies',(select count(*) from public.recruiter_companies where verification_status='verified'),'published_jobs',(select count(*) from public.moderated_jobs where source='jobpilot'),'direct_applications',(select count(*) from public.employer_applications),'pending_verifications',(select count(*) from public.company_verification_requests where status='pending'),'pending_reports',(select count(*) from public.job_reports where status='pending'),'open_support',(select count(*) from public.support_tickets where status<>'resolved')) into counts;
  select coalesce(jsonb_agg(to_jsonb(s)),'[]') into accounts from (
    select p.id,p.full_name,i.email,p.target_role,p.created_at,coalesce(a.status,'clear') as case_status,coalesce(a.notes,'') as case_notes,coalesce(a.version,0) as case_version,
      case when i.is_admin then 'admin' else 'member' end as access_role,
      exists(select 1 from public.account_deletion_requests where user_id=p.id) as deletion_pending
    from public.profiles p left join lateral jobpilot_private.recruiter_identity(p.id) i on true left join public.admin_account_cases a on a.user_id=p.id
    where p_query is null or position(lower(p_query) in lower(coalesce(p.full_name,'')||' '||coalesce(i.email,'')||' '||p.id::text))>0
    order by p.created_at desc,p.id limit 51 offset p_offset
  ) s;return jsonb_build_object('counts',counts,'accounts',accounts);
end $$;
