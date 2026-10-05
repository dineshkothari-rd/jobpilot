create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check(category in ('account','jobs','applications','resume','learning','other')),
  subject text not null check(length(trim(subject)) >= 5 and length(subject) <= 160),
  details text not null check(length(trim(details)) >= 20 and length(details) <= 4000),
  status text not null default 'open' check(status in ('open','in_progress','resolved')),
  response text check(length(response) <= 4000),
  version integer not null default 1 check(version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(status = 'open' or length(trim(coalesce(response,''))) between 10 and 4000)
);
create index support_tickets_owner_created on public.support_tickets(user_id,created_at desc,id desc);
create index support_tickets_queue_created on public.support_tickets(created_at desc,id desc);
alter table public.support_tickets enable row level security;
revoke all on public.support_tickets from public, anon, authenticated;
grant select on public.support_tickets to authenticated;
grant insert(user_id,category,subject,details) on public.support_tickets to authenticated;
grant update(status,response,version) on public.support_tickets to authenticated;
grant all on public.support_tickets to service_role;
create policy support_read on public.support_tickets for select to authenticated using (
  exists(select 1 from public.profiles where id=(select auth.uid()))
  and (user_id=(select auth.uid()) or (select auth.jwt()->'app_metadata'->>'role')='admin')
);
create policy support_submit on public.support_tickets for insert to authenticated with check (
  user_id=(select auth.uid()) and status='open' and version=1 and response is null
  and exists(select 1 from public.profiles where id=(select auth.uid()))
  and not exists(select 1 from public.account_deletion_requests where user_id=(select auth.uid()))
);
create policy support_reply on public.support_tickets for update to authenticated
using ((select auth.jwt()->'app_metadata'->>'role')='admin'
  and exists(select 1 from public.profiles where id=(select auth.uid()))
  and not exists(select 1 from public.account_deletion_requests where user_id=(select auth.uid())))
with check ((select auth.jwt()->'app_metadata'->>'role')='admin'
  and exists(select 1 from public.profiles where id=(select auth.uid()))
  and not exists(select 1 from public.account_deletion_requests where user_id=(select auth.uid())));
create function public.enforce_support_ticket() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='INSERT' then
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 39));
    if (select count(*) from public.support_tickets where user_id=new.user_id and created_at>now()-interval '24 hours') >= 5 then
      raise exception using errcode='P0001',message='support_rate_limit';
    end if;
  elsif new.version <> old.version+1 then
    raise exception using errcode='P0001',message='support_version_conflict';
  end if;
  return new;
end $$;
revoke all on function public.enforce_support_ticket() from public, anon, authenticated;
create trigger support_ticket_guard before insert or update on public.support_tickets
for each row execute function public.enforce_support_ticket();
create trigger support_ticket_updated_at before update on public.support_tickets
for each row execute function public.set_updated_at();
