create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default false,
  push_enabled boolean not null default false,
  timezone text not null default 'UTC' check(length(timezone) between 1 and 100)
);
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check(length(endpoint) between 10 and 2048),
  p256dh text not null check(length(p256dh) between 87 and 88),
  auth text not null check(length(auth) between 22 and 24),
  created_at timestamptz not null default now()
);
create index push_subscriptions_owner on public.push_subscriptions(user_id);
create table public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_day date not null,
  channel text not null check(channel in ('email','push')),
  recipient_key text not null check(length(recipient_key) between 1 and 36),
  status text not null default 'sending' check(status in ('sending','sent','failed')),
  attempts integer not null default 1 check(attempts between 1 and 3),
  lease_until timestamptz not null default now()+interval '5 minutes',
  sent_at timestamptz,
  unique(user_id,run_day,channel,recipient_key)
);
alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reminder_deliveries enable row level security;
revoke all on public.notification_preferences, public.push_subscriptions, public.reminder_deliveries from public, anon, authenticated;
grant select on public.notification_preferences, public.push_subscriptions, public.reminder_deliveries to authenticated;
grant insert(user_id,email_enabled,push_enabled,timezone), update(user_id,email_enabled,push_enabled,timezone) on public.notification_preferences to authenticated;
grant insert(user_id,endpoint,p256dh,auth), delete on public.push_subscriptions to authenticated;
grant all on public.notification_preferences, public.push_subscriptions, public.reminder_deliveries to service_role;
create policy notification_preferences_read on public.notification_preferences for select to authenticated using(user_id=(select auth.uid()));
create policy notification_preferences_insert on public.notification_preferences for insert to authenticated with check(user_id=(select auth.uid()) and not exists(select 1 from public.account_deletion_requests where user_id=(select auth.uid())));
create policy notification_preferences_update on public.notification_preferences for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and not exists(select 1 from public.account_deletion_requests where user_id=(select auth.uid())));
create policy push_subscriptions_read on public.push_subscriptions for select to authenticated using(user_id=(select auth.uid()));
create policy push_subscriptions_insert on public.push_subscriptions for insert to authenticated with check(user_id=(select auth.uid()) and not exists(select 1 from public.account_deletion_requests where user_id=(select auth.uid())));
create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated using(user_id=(select auth.uid()));
create policy reminder_deliveries_read on public.reminder_deliveries for select to authenticated using(user_id=(select auth.uid()));
create function public.guard_notification_preferences() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then
    raise exception 'Invalid reminder timezone';
  end if;
  return new;
end $$;
create trigger notification_timezone before insert or update on public.notification_preferences for each row execute function public.guard_notification_preferences();
create function public.limit_push_subscriptions() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,34));
  if (select count(*) from public.push_subscriptions where user_id=new.user_id)>=10 then
    raise exception using errcode='P0001',message='push_device_limit';
  end if;
  return new;
end $$;
create trigger push_device_limit before insert on public.push_subscriptions for each row execute function public.limit_push_subscriptions();
revoke all on function public.guard_notification_preferences(), public.limit_push_subscriptions() from public, anon, authenticated;
-- Only the worker can claim deliveries. Retries are bounded; stale workers cannot finish a newer attempt.
create function public.claim_reminder(p_user uuid,p_day date,p_channel text,p_recipient text)
returns table(id uuid,attempts integer) language plpgsql security invoker set search_path='' as $$
begin
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
revoke all on function public.claim_reminder(uuid,date,text,text) from public, anon, authenticated;
grant execute on function public.claim_reminder(uuid,date,text,text) to service_role;
