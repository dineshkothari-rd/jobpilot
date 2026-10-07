-- Free-launch sourcing and communication. Browser writes are denied; service RPCs bind fresh Auth identities.
create table public.recruiter_shortlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.recruiter_companies(id) on delete cascade,
  candidate_id uuid not null references auth.users(id) on delete cascade,
  status text not null check(status in ('shortlist','in_review','contacted','passed')),
  notes text not null default '' check(length(notes)<=4000),
  version integer not null default 1 check(version>0),
  updated_at timestamptz not null default now(), unique(company_id,candidate_id)
);
create table public.hiring_threads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.recruiter_companies(id) on delete cascade,
  candidate_id uuid not null references auth.users(id) on delete cascade,
  blocked boolean not null default false,
  updated_at timestamptz not null default now(), unique(company_id,candidate_id)
);
create table public.hiring_messages (
  id uuid primary key,
  thread_id uuid not null references public.hiring_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check(length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default clock_timestamp()
);
create table public.hiring_invitations (
  id uuid primary key,
  thread_id uuid not null references public.hiring_threads(id) on delete cascade,
  candidate_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  round text not null check(length(trim(round)) between 1 and 120),
  starts_at timestamptz not null,
  timezone text not null check(length(timezone)<=100),
  duration_minutes integer not null check(duration_minutes between 5 and 480),
  location text not null default '' check(length(location)<=1000),
  notes text not null default '' check(length(notes)<=2000),
  response text not null default '' check(length(response)<=1000),
  status text not null default 'pending' check(status in ('pending','accepted','reschedule_requested','declined','cancelled')),
  version integer not null default 1 check(version>0),
  created_at timestamptz not null default now()
);
create table public.hiring_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  kind text not null check(kind in ('profile_view','resume_view','message','interview')),
  thread_id uuid references public.hiring_threads(id) on delete cascade,
  event_key text not null check(length(event_key)<=200),
  read_at timestamptz,
  created_at timestamptz not null default clock_timestamp(), unique(user_id,event_key)
);
create index recruiter_shortlists_owner on public.recruiter_shortlists(user_id,updated_at desc,id);
create index hiring_threads_candidate on public.hiring_threads(candidate_id,updated_at desc,id);
create index hiring_messages_thread on public.hiring_messages(thread_id,created_at desc,id);
create index hiring_invitations_thread on public.hiring_invitations(thread_id,created_at desc,id);
create index hiring_notifications_owner on public.hiring_notifications(user_id,created_at desc,id);
alter table public.recruiter_shortlists enable row level security;
alter table public.hiring_threads enable row level security;
alter table public.hiring_messages enable row level security;
alter table public.hiring_invitations enable row level security;
alter table public.hiring_notifications enable row level security;
revoke all on public.recruiter_shortlists,public.hiring_threads,public.hiring_messages,public.hiring_invitations,public.hiring_notifications from public,anon,authenticated;
grant select on public.recruiter_shortlists,public.hiring_notifications to authenticated;
grant all on public.recruiter_shortlists,public.hiring_threads,public.hiring_invitations,public.hiring_notifications to service_role;
grant select,insert on public.hiring_messages to service_role;
create policy shortlist_owner on public.recruiter_shortlists for select to authenticated using(user_id=(select auth.uid()));
create policy hiring_notification_owner on public.hiring_notifications for select to authenticated using(user_id=(select auth.uid()));

create function public.hiring_company(p_user uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare company uuid;
begin
  if not exists(select 1 from public.profiles where id=p_user) or exists(select 1 from public.account_deletion_requests where user_id=p_user) then raise exception 'account_unavailable';end if;
  select id into company from public.recruiter_companies where user_id=p_user and verification_status='verified';
  if company is null then raise exception 'company_not_verified';end if;return company;
end $$;
create function public.hiring_contact_allowed(p_company uuid,p_candidate uuid) returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from public.recruiter_companies c where c.id=p_company and c.verification_status='verified' and c.user_id<>p_candidate
    and not exists(select 1 from public.account_deletion_requests where user_id in(c.user_id,p_candidate))
    and exists(select 1 from public.profiles where id=p_candidate)
    and (exists(select 1 from public.employer_applications a where a.company_id=c.id and a.user_id=p_candidate and a.status not in ('withdrawn','rejected'))
      or exists(select 1 from public.candidate_visibility v where v.user_id=p_candidate and v.discoverable and not v.anonymous)))
$$;
create function public.search_hiring_candidates(p_user uuid,p_role text,p_location text,p_skill text,p_experience integer,p_offset integer,p_shortlists boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare company uuid:=public.hiring_company(p_user); result jsonb;
begin
  if p_offset is null or p_offset not between 0 and 100000 or p_experience is not null and p_experience not between 0 and 80 or greatest(length(p_role),length(p_location),length(p_skill))>100 or p_shortlists is null then raise exception 'invalid_application';end if;
  -- ponytail: parameterized substring matching over opted-in skills; use a search index when pilot inventory warrants it.
  select coalesce(jsonb_agg(to_jsonb(s)),'[]') into result from (
    select p.id,case when v.anonymous then 'Anonymous candidate' else p.full_name end as full_name,p.target_role,p.location,p.experience_years,
      coalesce(r.parsed_data->'skills','{}'::jsonb) as skills,v.anonymous,
      l.id as shortlist_id,l.status as shortlist_status,l.notes as shortlist_notes,coalesce(l.version,0) as shortlist_version
    from public.candidate_visibility v join public.profiles p on p.id=v.user_id left join public.resumes r on r.id=v.resume_id and r.user_id=v.user_id
      left join public.recruiter_shortlists l on l.company_id=company and l.candidate_id=p.id
    where v.discoverable and p.id<>p_user and not exists(select 1 from public.account_deletion_requests where user_id=p.id)
      and (not p_shortlists or l.id is not null)
      and (p_role is null or position(lower(p_role) in lower(coalesce(p.target_role,'')))>0)
      and (p_location is null or position(lower(p_location) in lower(coalesce(p.location,'')))>0)
      and (p_skill is null or position(lower(p_skill) in lower(coalesce((r.parsed_data->'skills')::text,'')))>0)
      and (p_experience is null or p.experience_years>=p_experience)
    order by v.updated_at desc,p.id limit 51 offset p_offset
  ) s;return result;
end $$;
create function public.save_recruiter_shortlist(p_user uuid,p_candidate uuid,p_version integer,p_status text,p_notes text)
returns void language plpgsql security invoker set search_path='' as $$
declare company uuid; current_version integer;
begin
  perform 1 from public.profiles where id=p_user for update;company:=public.hiring_company(p_user);
  perform 1 from public.candidate_visibility where user_id=p_candidate and discoverable for share;
  if not found or p_candidate=p_user or exists(select 1 from public.account_deletion_requests where user_id=p_candidate) then raise exception 'application_unavailable';end if;
  select version into current_version from public.recruiter_shortlists where company_id=company and candidate_id=p_candidate;
  if coalesce(current_version,0) is distinct from p_version then raise exception 'application_conflict';end if;
  if p_status is null or p_status not in ('shortlist','in_review','contacted','passed') or p_notes is null or length(p_notes)>4000 then raise exception 'invalid_application';end if;
  if current_version is null and (select count(*) from public.recruiter_shortlists where company_id=company)>=1000 then raise exception 'hiring_limit';end if;
  insert into public.recruiter_shortlists(user_id,company_id,candidate_id,status,notes) values(p_user,company,p_candidate,p_status,p_notes)
    on conflict(company_id,candidate_id) do update set status=excluded.status,notes=excluded.notes,version=public.recruiter_shortlists.version+1,updated_at=now();
end $$;
create function public.record_hiring_view(p_user uuid,p_candidate uuid,p_resume boolean) returns void language plpgsql security invoker set search_path='' as $$
declare company uuid; name text; day text:=to_char(now() at time zone 'UTC','YYYY-MM-DD');
begin
  perform 1 from public.profiles where id=p_user for update;company:=public.hiring_company(p_user);
  if p_resume is null or not exists(select 1 from public.candidate_visibility where user_id=p_candidate and discoverable and (not p_resume or resume_id is not null and not anonymous)) or exists(select 1 from public.account_deletion_requests where user_id=p_candidate) then raise exception 'application_unavailable';end if;
  select c.name into name from public.recruiter_companies c where c.id=company;
  if (select count(*) from public.hiring_notifications where event_key like company::text||':%' and created_at>now()-interval '24 hours')>=1000 then return;end if;
  insert into public.hiring_notifications(user_id,company_name,kind,event_key) values(p_candidate,name,'profile_view',company||':profile:'||p_candidate||':'||day) on conflict(user_id,event_key) do nothing;
  if p_resume then insert into public.hiring_notifications(user_id,company_name,kind,event_key) values(p_candidate,name,'resume_view',company||':resume:'||p_candidate||':'||day) on conflict(user_id,event_key) do nothing;end if;
end $$;
create function public.open_hiring_thread(p_user uuid,p_candidate uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare company uuid; target uuid; b boolean;
begin
  perform 1 from public.profiles where id=p_user for update;company:=public.hiring_company(p_user);
  perform 1 from public.profiles where id=p_candidate for share;
  if not public.hiring_contact_allowed(company,p_candidate) then raise exception 'application_unavailable';end if;
  select id,blocked into target,b from public.hiring_threads where company_id=company and candidate_id=p_candidate;
  if b then raise exception 'thread_blocked';end if;
  if target is not null then return target;end if;
  if not exists(select 1 from public.employer_applications where company_id=company and user_id=p_candidate and status not in ('withdrawn','rejected'))
    and not exists(select 1 from public.recruiter_shortlists where company_id=company and candidate_id=p_candidate and status<>'passed') then raise exception 'application_unavailable';end if;
  if (select count(*) from public.hiring_threads where company_id=company and updated_at>now()-interval '24 hours')>=100 then raise exception 'hiring_limit';end if;
  insert into public.hiring_threads(company_id,candidate_id) values(company,p_candidate) returning id into target;return target;
end $$;
create function public.get_hiring_thread(p_user uuid,p_thread uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.hiring_threads; c public.recruiter_companies;
begin
  select * into t from public.hiring_threads where id=p_thread;select * into c from public.recruiter_companies where id=t.company_id;
  if t.id is null or p_user not in(t.candidate_id,c.user_id) or not exists(select 1 from public.profiles where id=p_user) or exists(select 1 from public.account_deletion_requests where user_id in(t.candidate_id,c.user_id)) or (p_user=c.user_id and (t.blocked or not public.hiring_contact_allowed(c.id,t.candidate_id))) then raise exception 'application_unavailable';end if;
  return to_jsonb(t)||jsonb_build_object('company_name',c.name,'is_candidate',p_user=t.candidate_id,'can_send',not t.blocked and public.hiring_contact_allowed(c.id,t.candidate_id));
end $$;
create function public.list_hiring_threads(p_user uuid,p_offset integer) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  if p_offset is null or p_offset not between 0 and 100000 or not exists(select 1 from public.profiles where id=p_user) or exists(select 1 from public.account_deletion_requests where user_id=p_user) then raise exception 'account_unavailable';end if;
  select coalesce(jsonb_agg(to_jsonb(s)),'[]') into result from (
    select t.id,t.blocked,t.updated_at,c.name as company_name,p_user=t.candidate_id as is_candidate,
      case when p_user=t.candidate_id then 'Your conversation' else coalesce(p.full_name,'Candidate') end as participant
    from public.hiring_threads t join public.recruiter_companies c on c.id=t.company_id join public.profiles p on p.id=t.candidate_id
    where not exists(select 1 from public.account_deletion_requests where user_id in(t.candidate_id,c.user_id)) and (t.candidate_id=p_user or c.user_id=p_user and not t.blocked and public.hiring_contact_allowed(c.id,t.candidate_id))
    order by t.updated_at desc,t.id limit 51 offset p_offset
  ) s;return result;
end $$;
create function public.send_hiring_message(p_user uuid,p_thread uuid,p_id uuid,p_body text) returns void language plpgsql security invoker set search_path='' as $$
declare t jsonb; previous public.hiring_messages; recipient uuid;
begin
  perform 1 from public.profiles where id=p_user for update;
  perform 1 from public.hiring_threads where id=p_thread for update;t:=public.get_hiring_thread(p_user,p_thread);
  if not (t->>'can_send')::boolean then raise exception 'thread_blocked';end if;
  select * into previous from public.hiring_messages where id=p_id;
  if previous.id is not null then if previous.sender_id=p_user and previous.thread_id=p_thread and previous.body=p_body then return;else raise exception 'application_conflict';end if;end if;
  if p_body is null or length(trim(p_body)) not between 1 and 4000 then raise exception 'invalid_application';end if;
  if (select count(*) from public.hiring_messages where sender_id=p_user and created_at>now()-interval '24 hours')>=100 or (select count(*) from public.hiring_messages where thread_id=p_thread and sender_id=p_user and created_at>now()-interval '1 minute')>=20 then raise exception 'hiring_limit';end if;
  recipient:=case when (t->>'is_candidate')::boolean then (select user_id from public.recruiter_companies where id=(t->>'company_id')::uuid) else (t->>'candidate_id')::uuid end;
  insert into public.hiring_messages(id,thread_id,sender_id,body) values(p_id,p_thread,p_user,p_body);
  update public.hiring_threads set updated_at=clock_timestamp() where id=p_thread;
  insert into public.hiring_notifications(user_id,company_name,kind,thread_id,event_key) values(recipient,t->>'company_name','message',p_thread,'message:'||p_id);
end $$;
create function public.set_hiring_thread_block(p_user uuid,p_thread uuid,p_blocked boolean) returns void language plpgsql security invoker set search_path='' as $$
declare t jsonb;
begin
  perform 1 from public.hiring_threads where id=p_thread for update;t:=public.get_hiring_thread(p_user,p_thread);
  if not (t->>'is_candidate')::boolean or p_blocked is null then raise exception 'application_unavailable';end if;
  update public.hiring_threads set blocked=p_blocked where id=p_thread;
end $$;
create function public.save_hiring_invitation(p_user uuid,p_id uuid,p_thread uuid,p_job uuid,p_version integer,p_fields jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare t jsonb; previous public.hiring_invitations; target public.jobs;
begin
  perform 1 from public.hiring_threads where id=p_thread for update;t:=public.get_hiring_thread(p_user,p_thread);
  if (t->>'is_candidate')::boolean or not (t->>'can_send')::boolean then raise exception 'application_unavailable';end if;
  select * into previous from public.hiring_invitations where id=p_id;
  if p_version=0 and previous.id is not null then if previous.thread_id=p_thread and previous.job_id=p_job and previous.round=p_fields->>'round' and previous.starts_at=(p_fields->>'starts_at')::timestamptz and previous.timezone=p_fields->>'timezone' and previous.duration_minutes=(p_fields->>'duration_minutes')::integer and previous.location=p_fields->>'location' and previous.notes=p_fields->>'notes' then return;else raise exception 'application_conflict';end if;end if;
  if previous.id is not null and (previous.thread_id<>p_thread or previous.version is distinct from p_version or previous.status not in ('pending','reschedule_requested')) or previous.id is null and p_version is distinct from 0 then raise exception 'application_conflict';end if;
  select * into target from public.jobs where id=p_job and recruiter_company_id=(t->>'company_id')::uuid and posting_status='published' and (expires_at is null or expires_at>now()) and not exists(select 1 from public.hidden_jobs where job_id=p_job);
  if target.id is null or p_fields is null or (p_fields->>'starts_at')::timestamptz not between now() and now()+interval '1 year' or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_fields->>'timezone') then raise exception 'invalid_application';end if;
  if previous.id is null and (select count(*) from public.hiring_invitations where thread_id=p_thread and created_at>now()-interval '24 hours')>=10 then raise exception 'hiring_limit';end if;
  insert into public.hiring_invitations(id,thread_id,candidate_id,job_id,round,starts_at,timezone,duration_minutes,location,notes)
    values(p_id,p_thread,(t->>'candidate_id')::uuid,p_job,p_fields->>'round',(p_fields->>'starts_at')::timestamptz,p_fields->>'timezone',(p_fields->>'duration_minutes')::integer,p_fields->>'location',p_fields->>'notes')
    on conflict(id) do update set job_id=excluded.job_id,round=excluded.round,starts_at=excluded.starts_at,timezone=excluded.timezone,duration_minutes=excluded.duration_minutes,location=excluded.location,notes=excluded.notes,status='pending',response='',version=public.hiring_invitations.version+1;
  insert into public.hiring_notifications(user_id,company_name,kind,thread_id,event_key) values((t->>'candidate_id')::uuid,t->>'company_name','interview',p_thread,'invitation:'||p_id||':'||(coalesce(previous.version,0)+1));
end $$;
create function public.respond_hiring_invitation(p_user uuid,p_id uuid,p_version integer,p_status text,p_response text) returns void language plpgsql security invoker set search_path='' as $$
declare i public.hiring_invitations; t jsonb; application uuid; recipient uuid;
begin
  select * into i from public.hiring_invitations where id=p_id;
  perform 1 from public.hiring_threads where id=i.thread_id for update;
  select * into i from public.hiring_invitations where id=p_id for update;t:=public.get_hiring_thread(p_user,i.thread_id);
  if i.version is distinct from p_version or i.status not in ('pending','reschedule_requested','accepted') then raise exception 'application_conflict';end if;
  if not (t->>'can_send')::boolean or p_response is null or length(p_response)>1000 or p_status is null or ((t->>'is_candidate')::boolean and (p_status not in ('accepted','reschedule_requested','declined') or i.status='accepted')) or (not (t->>'is_candidate')::boolean and p_status<>'cancelled') then raise exception 'invalid_application';end if;
  if p_status='accepted' then
    if i.starts_at<=now() or not exists(select 1 from public.moderated_jobs where id=i.job_id and recruiter_company_id=(t->>'company_id')::uuid and (expires_at is null or expires_at>now())) then raise exception 'job_unavailable';end if;
    -- Accepting a sourcing invitation saves a private tracker, never pretends the candidate submitted an application.
    insert into public.applications(user_id,job_id,status) values(p_user,i.job_id,'saved') on conflict(user_id,job_id) do nothing;
    select id into application from public.applications where user_id=p_user and job_id=i.job_id;
    if exists(select 1 from public.application_interviews where id=i.id) then raise exception 'application_conflict';end if;
    insert into public.application_interviews(id,user_id,application_id,round,starts_at,timezone,duration_minutes,location,notes) values(i.id,p_user,application,i.round,i.starts_at,i.timezone,i.duration_minutes,i.location,i.notes);
  elsif p_status='cancelled' then update public.application_interviews set status='cancelled',version=version+1 where id=i.id and user_id=i.candidate_id and status='scheduled';end if;
  update public.hiring_invitations set status=p_status,response=p_response,version=version+1 where id=i.id;
  recipient:=case when (t->>'is_candidate')::boolean then (select user_id from public.recruiter_companies where id=(t->>'company_id')::uuid) else i.candidate_id end;
  insert into public.hiring_notifications(user_id,company_name,kind,thread_id,event_key) values(recipient,t->>'company_name','interview',i.thread_id,'response:'||i.id||':'||(i.version+1));
end $$;
-- No browser access to threads/messages/invitations: fresh participant and revocation checks run for every API read/write.
revoke all on function public.hiring_company(uuid),public.hiring_contact_allowed(uuid,uuid),public.search_hiring_candidates(uuid,text,text,text,integer,integer,boolean),public.save_recruiter_shortlist(uuid,uuid,integer,text,text),public.record_hiring_view(uuid,uuid,boolean),public.open_hiring_thread(uuid,uuid),public.get_hiring_thread(uuid,uuid),public.list_hiring_threads(uuid,integer),public.send_hiring_message(uuid,uuid,uuid,text),public.set_hiring_thread_block(uuid,uuid,boolean),public.save_hiring_invitation(uuid,uuid,uuid,uuid,integer,jsonb),public.respond_hiring_invitation(uuid,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.hiring_company(uuid),public.hiring_contact_allowed(uuid,uuid),public.search_hiring_candidates(uuid,text,text,text,integer,integer,boolean),public.save_recruiter_shortlist(uuid,uuid,integer,text,text),public.record_hiring_view(uuid,uuid,boolean),public.open_hiring_thread(uuid,uuid),public.get_hiring_thread(uuid,uuid),public.list_hiring_threads(uuid,integer),public.send_hiring_message(uuid,uuid,uuid,text),public.set_hiring_thread_block(uuid,uuid,boolean),public.save_hiring_invitation(uuid,uuid,uuid,uuid,integer,jsonb),public.respond_hiring_invitation(uuid,uuid,integer,text,text) to service_role;

alter publication supabase_realtime add table public.hiring_notifications;

create function public.get_hiring_export_rows(p_user uuid,p_kind text,p_offset integer) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  if not exists(select 1 from public.profiles where id=p_user) or p_offset is null or p_offset<0 then raise exception 'account_unavailable';end if;
  if p_kind='threads' then select coalesce(jsonb_agg(to_jsonb(s)),'[]') into result from (select t.* from public.hiring_threads t join public.recruiter_companies c on c.id=t.company_id where t.candidate_id=p_user or c.user_id=p_user order by t.id limit 500 offset p_offset) s;
  elsif p_kind='messages' then select coalesce(jsonb_agg(to_jsonb(s)),'[]') into result from (select m.* from public.hiring_messages m join public.hiring_threads t on t.id=m.thread_id join public.recruiter_companies c on c.id=t.company_id where t.candidate_id=p_user or c.user_id=p_user order by m.id limit 500 offset p_offset) s;
  elsif p_kind='invitations' then select coalesce(jsonb_agg(to_jsonb(s)),'[]') into result from (select i.* from public.hiring_invitations i join public.hiring_threads t on t.id=i.thread_id join public.recruiter_companies c on c.id=t.company_id where t.candidate_id=p_user or c.user_id=p_user order by i.id limit 500 offset p_offset) s;
  else raise exception 'invalid_application';end if;return result;
end $$;
revoke all on function public.get_hiring_export_rows(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.get_hiring_export_rows(uuid,text,integer) to service_role;
