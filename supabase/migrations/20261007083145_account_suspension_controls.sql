-- Native Auth bans stop new/refresh sign-in; fresh checks also block already issued JWTs.
create function jobpilot_private.account_is_active(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=p_user and (banned_until is null or banned_until<=now()))
$$;
revoke all on function jobpilot_private.account_is_active(uuid) from public,anon,authenticated;
grant execute on function jobpilot_private.account_is_active(uuid) to service_role;
create function jobpilot_private.current_account_is_active() returns boolean language sql stable security definer set search_path='' as $$
 select jobpilot_private.account_is_active((select auth.uid()))
$$;
revoke all on function jobpilot_private.current_account_is_active() from public,anon,authenticated;
grant execute on function jobpilot_private.current_account_is_active() to authenticated;
create function public.current_account_is_active() returns boolean language sql security invoker set search_path='' as $$
 select jobpilot_private.current_account_is_active()
$$;
revoke all on function public.current_account_is_active() from public,anon,authenticated;
grant execute on function public.current_account_is_active() to authenticated;
-- Restrictive policies combine with existing ownership/consent policies, including Storage.
do $$ declare item record;begin
 for item in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and c.relrowsecurity and (n.nspname='public' or n.nspname='storage' and c.relname='objects') loop
 execute format('create policy active_account_required on %I.%I as restrictive for all to authenticated using ((select jobpilot_private.current_account_is_active())) with check ((select jobpilot_private.current_account_is_active()))',item.nspname,item.relname);
 end loop;
end $$;
create function jobpilot_private.set_account_suspension(p_actor uuid,p_user uuid,p_expected boolean,p_suspended boolean,p_reason text) returns boolean language plpgsql security definer set search_path='' as $$
declare stored boolean;
begin
 if p_actor is null or p_user is null or p_actor=p_user then raise exception 'self_suspension';end if;
 if p_expected is null or p_suspended is null or p_reason is null or length(trim(p_reason)) not between 10 and 1000 then raise exception 'invalid_suspension';end if;
 -- ponytail: share the rare admin-write lock with role changes; use per-account locks if admin traffic grows.
 perform pg_catalog.pg_advisory_xact_lock(734112309::bigint);
 perform id from auth.users where id in(p_actor,p_user) order by id for update;
 if not exists(select 1 from auth.users u join public.profiles p on p.id=u.id where u.id=p_actor and u.raw_app_meta_data->>'role'='admin' and (u.banned_until is null or u.banned_until<=now())) or exists(select 1 from public.account_deletion_requests where user_id in(p_actor,p_user)) then raise exception 'admin_required';end if;
 if exists(select 1 from auth.users where id=p_user and raw_app_meta_data->>'role'='admin') then raise exception 'admin_suspension';end if;
 select banned_until is not null and banned_until>now() into stored from auth.users u join public.profiles p on p.id=u.id where u.id=p_user;
 if stored is null then raise exception 'account_unavailable';end if;
 if stored is distinct from p_expected then raise exception 'suspension_conflict';end if;
 if stored=p_suspended then return false;end if;
 update auth.users set banned_until=case when p_suspended then now()+interval '100 years' else null end,updated_at=now() where id=p_user;
 -- Removing refresh sessions never substitutes for the fresh RLS check above.
 if p_suspended then delete from auth.sessions where user_id=p_user;end if;
 insert into public.admin_operation_events(actor_id,user_id,status,reason) values(p_actor,p_user,case when p_suspended then 'account_suspended' else 'account_restored' end,trim(p_reason));
 return true;
end $$;
revoke all on function jobpilot_private.set_account_suspension(uuid,uuid,boolean,boolean,text) from public,anon,authenticated;
grant execute on function jobpilot_private.set_account_suspension(uuid,uuid,boolean,boolean,text) to service_role;
create function public.set_account_suspension(p_actor uuid,p_user uuid,p_expected boolean,p_suspended boolean,p_reason text) returns boolean language sql security invoker set search_path='' as $$
 select jobpilot_private.set_account_suspension(p_actor,p_user,p_expected,p_suspended,p_reason)
$$;
revoke all on function public.set_account_suspension(uuid,uuid,boolean,boolean,text) from public,anon,authenticated;
grant execute on function public.set_account_suspension(uuid,uuid,boolean,boolean,text) to service_role;

create or replace function public.consume_launch_allowance(p_user uuid,p_meter text) returns integer language plpgsql security invoker set search_path='' as $$
declare quota integer; result integer; today date:=(now() at time zone 'UTC')::date;
begin
 if not jobpilot_private.account_is_active(p_user) then raise exception 'account_suspended';end if;
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

create or replace function public.claim_reminder(p_user uuid,p_day date,p_channel text,p_recipient text)
returns table(id uuid,attempts integer) language plpgsql security invoker set search_path='' as $$
begin
 if not jobpilot_private.account_is_active(p_user) then raise exception 'account_suspended';end if;
  if p_day<>(now() at time zone 'UTC')::date or exists(select 1 from public.account_deletion_requests where user_id=p_user)
    or not exists(select 1 from public.notification_preferences where user_id=p_user
      and ((p_channel='email' and email_enabled and p_recipient='email')
        or (p_channel='push' and push_enabled and exists(select 1 from public.push_subscriptions where user_id=p_user and push_subscriptions.id::text=p_recipient)))) then
    return;
  end if;
  return query insert into public.reminder_deliveries as d(user_id,run_day,channel,recipient_key)
    values(p_user,p_day,p_channel,p_recipient)
    on conflict(user_id,run_day,channel,recipient_key) do update
      set status='sending',attempts=d.attempts+1,lease_until=now()+interval '5 minutes'
      where d.attempts<3 and (d.status='failed' or (d.status='sending' and d.lease_until<now()))
    returning d.id,d.attempts;
end $$;

create or replace function public.claim_job_alert(p_user uuid,p_day date,p_channel text,p_recipient text)
returns table(id uuid,attempts integer) language plpgsql security invoker set search_path='' as $$
begin
 if not jobpilot_private.account_is_active(p_user) then raise exception 'account_suspended';end if;
  if p_day<>(now() at time zone 'UTC')::date or exists(select 1 from public.account_deletion_requests where user_id=p_user)
    or not exists(select 1 from public.job_alert_runs where user_id=p_user and run_day=p_day and cardinality(job_ids)>0 and window_end>=(select enabled_at from public.job_alert_preferences where user_id=p_user))
    or not exists(select 1 from public.job_alert_preferences where user_id=p_user and
      ((p_channel='email' and email_enabled and p_recipient='email') or
       (p_channel='push' and push_enabled and exists(select 1 from public.push_subscriptions where user_id=p_user and push_subscriptions.id::text=p_recipient)))) then return; end if;
  return query insert into public.job_alert_deliveries as d(user_id,run_day,channel,recipient_key)
    values(p_user,p_day,p_channel,p_recipient) on conflict(user_id,run_day,channel,recipient_key) do update
    set status='sending',attempts=d.attempts+1,lease_until=now()+interval '5 minutes'
    where d.attempts<3 and (d.status='failed' or (d.status='sending' and d.lease_until<now())) returning d.id,d.attempts;
end $$;

create or replace function public.get_admin_operations(p_user uuid,p_offset integer,p_query text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare accounts jsonb; counts jsonb;
begin
  if not exists(select 1 from jobpilot_private.recruiter_identity(p_user) where is_admin) or exists(select 1 from public.account_deletion_requests where user_id=p_user) or not exists(select 1 from public.profiles where id=p_user) then raise exception 'application_unavailable';end if;
  if p_offset is null or p_offset not between 0 and 100000 or length(p_query)>200 then raise exception 'invalid_application';end if;
  select jsonb_build_object('accounts',(select count(*) from public.profiles),'verified_companies',(select count(*) from public.recruiter_companies where verification_status='verified'),'published_jobs',(select count(*) from public.moderated_jobs where source='jobpilot'),'direct_applications',(select count(*) from public.employer_applications),'pending_verifications',(select count(*) from public.company_verification_requests where status='pending'),'pending_reports',(select count(*) from public.job_reports where status='pending'),'open_support',(select count(*) from public.support_tickets where status<>'resolved')) into counts;
  select coalesce(jsonb_agg(to_jsonb(s)),'[]') into accounts from (
    select p.id,p.full_name,i.email,p.target_role,p.created_at,coalesce(a.status,'clear') as case_status,coalesce(a.notes,'') as case_notes,coalesce(a.version,0) as case_version,
      case when i.is_admin then 'admin' else 'member' end as access_role,
      not jobpilot_private.account_is_active(p.id) as account_suspended,
      exists(select 1 from public.account_deletion_requests where user_id=p.id) as deletion_pending
    from public.profiles p left join lateral jobpilot_private.recruiter_identity(p.id) i on true left join public.admin_account_cases a on a.user_id=p.id
    where p_query is null or position(lower(p_query) in lower(coalesce(p.full_name,'')||' '||coalesce(i.email,'')||' '||p.id::text))>0
    order by p.created_at desc,p.id limit 51 offset p_offset
  ) s;return jsonb_build_object('counts',counts,'accounts',accounts);
end $$;

create or replace function public.claim_calendar_sync(p_user uuid,p_connection uuid,p_token uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 if not jobpilot_private.account_is_active(p_user) then return false;end if;
  update public.calendar_connections set lease_until=now()+interval '3 minutes',lease_token=p_token
  where id=p_connection and user_id=p_user and (lease_until is null or lease_until<now())
    and not exists(select 1 from public.account_deletion_requests where user_id=p_user);
  return found;
end $$;
