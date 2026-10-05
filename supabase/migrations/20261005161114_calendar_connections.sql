create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check(provider in ('google','outlook')),
  created_at timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  unique(user_id,provider), unique(id,user_id)
);
create table public.calendar_tokens (
  connection_id uuid primary key references public.calendar_connections(id) on delete cascade,
  access_token text not null check(length(access_token) between 1 and 32000),
  refresh_token text not null check(length(refresh_token) between 1 and 32000),
  expires_at timestamptz not null
);
alter table public.application_interviews add constraint interviews_id_owner_unique unique(id,user_id);
create table public.calendar_event_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null,
  interview_id uuid not null,
  event_id text not null default '' check(length(event_id)<=2048),
  etag text check(length(etag)<=2048),
  synced_at timestamptz,
  unique(connection_id,interview_id),
  foreign key(connection_id,user_id) references public.calendar_connections(id,user_id) on delete cascade,
  foreign key(interview_id,user_id) references public.application_interviews(id,user_id) on delete cascade
);
create index calendar_event_links_owner on public.calendar_event_links(user_id,interview_id);
alter table public.calendar_connections enable row level security;
alter table public.calendar_tokens enable row level security;
alter table public.calendar_event_links enable row level security;
revoke all on public.calendar_connections, public.calendar_tokens, public.calendar_event_links from public, anon, authenticated;
grant select(id,user_id,provider,created_at) on public.calendar_connections to authenticated;
grant select on public.calendar_event_links to authenticated;
grant all on public.calendar_connections, public.calendar_tokens, public.calendar_event_links to service_role;
create policy calendar_connections_owner on public.calendar_connections for select to authenticated using(user_id=(select auth.uid()));
create policy calendar_links_owner on public.calendar_event_links for select to authenticated using(user_id=(select auth.uid()));
create function public.claim_calendar_sync(p_user uuid,p_connection uuid,p_token uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
  update public.calendar_connections set lease_until=now()+interval '3 minutes',lease_token=p_token
  where id=p_connection and user_id=p_user and (lease_until is null or lease_until<now())
    and not exists(select 1 from public.account_deletion_requests where user_id=p_user);
  return found;
end $$;
revoke all on function public.claim_calendar_sync(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_calendar_sync(uuid,uuid,uuid) to service_role;
create function public.store_calendar_connection(p_id uuid,p_user uuid,p_provider text,p_access text,p_refresh text,p_expires timestamptz) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if exists(select 1 from public.account_deletion_requests where user_id=p_user) then raise exception 'Account deletion pending'; end if;
  insert into public.calendar_connections(id,user_id,provider) values(p_id,p_user,p_provider);
  insert into public.calendar_tokens(connection_id,access_token,refresh_token,expires_at) values(p_id,p_access,p_refresh,p_expires);
end $$;
revoke all on function public.store_calendar_connection(uuid,uuid,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.store_calendar_connection(uuid,uuid,text,text,text,timestamptz) to service_role;
create function public.import_calendar_round(p_user uuid,p_link uuid,p_version integer,p_event jsonb,p_etag text) returns void
language plpgsql security invoker set search_path='' as $$
declare v_interview uuid;
begin
  select interview_id into v_interview from public.calendar_event_links where id=p_link and user_id=p_user;
  if v_interview is null or exists(select 1 from public.account_deletion_requests where user_id=p_user) then raise exception 'Calendar round unavailable'; end if;
  update public.application_interviews set
    round=coalesce(p_event->>'round',round), starts_at=coalesce((p_event->>'starts_at')::timestamptz,starts_at),
    duration_minutes=coalesce((p_event->>'duration_minutes')::integer,duration_minutes),
    location=coalesce(p_event->>'location',location), status=coalesce(p_event->>'status',status), version=version+1
  where id=v_interview and user_id=p_user and version=p_version;
  if not found then raise exception using errcode='P0001',message='calendar_version_conflict'; end if;
  update public.calendar_event_links set etag=p_etag,synced_at=now() where id=p_link and user_id=p_user;
end $$;
revoke all on function public.import_calendar_round(uuid,uuid,integer,jsonb,text) from public, anon, authenticated;
grant execute on function public.import_calendar_round(uuid,uuid,integer,jsonb,text) to service_role;
