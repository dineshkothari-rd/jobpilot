-- Ingestion/first-publication time is separate from the source's original posting date.
alter table public.jobs add column alert_available_at timestamptz not null default now();
create index jobs_alert_available on public.jobs(alert_available_at,id) where created_by is null;
create or replace view public.moderated_jobs with(security_invoker=true) as select j.* from public.jobs j where not exists(select 1 from public.hidden_jobs h where h.job_id=j.id);
revoke all on public.moderated_jobs from public,anon,authenticated;
grant select on public.moderated_jobs to service_role;
create table public.job_alert_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default false,
  push_enabled boolean not null default false,
  enabled_at timestamptz not null default now()
);
create table public.job_alert_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_day date not null,
  window_end timestamptz not null,
  job_ids uuid[] not null default '{}',
  digest text not null check(length(digest)<=20000),
  unique(user_id,run_day)
);
create table public.job_alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_day date not null,
  channel text not null check(channel in ('email','push')),
  recipient_key text not null check(length(recipient_key) between 1 and 36),
  status text not null default 'sending' check(status in ('sending','sent','failed')),
  attempts integer not null default 1 check(attempts between 1 and 3),
  lease_until timestamptz not null default now()+interval '5 minutes',
  sent_at timestamptz,
  unique(user_id,run_day,channel,recipient_key),
  foreign key(user_id,run_day) references public.job_alert_runs(user_id,run_day) on delete cascade
);
alter table public.job_alert_preferences enable row level security;
alter table public.job_alert_runs enable row level security;
alter table public.job_alert_deliveries enable row level security;
revoke all on public.job_alert_preferences,public.job_alert_runs,public.job_alert_deliveries from public,anon,authenticated;
grant select on public.job_alert_preferences,public.job_alert_runs,public.job_alert_deliveries to authenticated;
grant insert(user_id,email_enabled,push_enabled),update(user_id,email_enabled,push_enabled) on public.job_alert_preferences to authenticated;
grant all on public.job_alert_preferences,public.job_alert_runs,public.job_alert_deliveries to service_role;
create policy alert_preferences_read on public.job_alert_preferences for select to authenticated using(user_id=(select auth.uid()));
create policy alert_preferences_insert on public.job_alert_preferences for insert to authenticated with check(user_id=(select auth.uid()) and not exists(select 1 from public.account_deletion_requests where user_id=(select auth.uid())));
create policy alert_preferences_update on public.job_alert_preferences for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and not exists(select 1 from public.account_deletion_requests where user_id=(select auth.uid())));
create policy alert_runs_read on public.job_alert_runs for select to authenticated using(user_id=(select auth.uid()));
create policy alert_deliveries_read on public.job_alert_deliveries for select to authenticated using(user_id=(select auth.uid()));
create function public.claim_job_alert(p_user uuid,p_day date,p_channel text,p_recipient text)
returns table(id uuid,attempts integer) language plpgsql security invoker set search_path='' as $$
begin
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
revoke all on function public.claim_job_alert(uuid,date,text,text) from public,anon,authenticated;
grant execute on function public.claim_job_alert(uuid,date,text,text) to service_role;

create function public.reset_job_alert_start() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if (new.email_enabled or new.push_enabled) and not (old.email_enabled or old.push_enabled) then new.enabled_at:=now();end if;
  return new;
end $$;
revoke all on function public.reset_job_alert_start() from public,anon,authenticated;
create trigger job_alert_start before update on public.job_alert_preferences for each row execute function public.reset_job_alert_start();
