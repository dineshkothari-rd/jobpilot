-- Browser clients can read only their own records. All mutations use authenticated server RPCs.
create table public.candidate_visibility (
  user_id uuid primary key references auth.users(id) on delete cascade,
  discoverable boolean not null default false,
  anonymous boolean not null default false,
  share_contact boolean not null default false,
  resume_id uuid references public.resumes(id) on delete set null,
  version integer not null default 1 check(version>0),
  updated_at timestamptz not null default now()
);
create table public.employer_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.recruiter_companies(id) on delete set null,
  job_id uuid not null references public.jobs(id) on delete cascade,
  job_title text not null,
  company_name text not null,
  candidate_name text not null check(length(candidate_name) between 1 and 200),
  candidate_role text,
  candidate_location text,
  contact_email text,
  resume_text text not null check(length(resume_text)<=250000),
  match_score integer check(match_score between 0 and 100),
  cover_note text not null default '' check(length(cover_note)<=4000),
  status text not null default 'applied' check(status in ('applied','screening','interview','offer','rejected','withdrawn')),
  shortlisted boolean not null default false,
  version integer not null default 1 check(version>0),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,job_id)
);
create table public.employer_application_events (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.employer_applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor text not null check(actor in ('Candidate','Verified recruiter')),
  status text not null,
  shortlisted boolean not null,
  note text not null default '' check(length(note)<=1000),
  created_at timestamptz not null default clock_timestamp()
);
create index employer_applications_company on public.employer_applications(company_id,status,submitted_at desc);
create index employer_applications_candidate on public.employer_applications(user_id,submitted_at desc);
create index employer_application_history on public.employer_application_events(application_id,id desc);
alter table public.candidate_visibility enable row level security;
alter table public.employer_applications enable row level security;
alter table public.employer_application_events enable row level security;
revoke all on public.candidate_visibility,public.employer_applications,public.employer_application_events from public,anon,authenticated;
grant select on public.candidate_visibility,public.employer_applications,public.employer_application_events to authenticated;
grant all on public.candidate_visibility,public.employer_applications to service_role;
grant select,insert on public.employer_application_events to service_role;
grant usage,select on sequence public.employer_application_events_id_seq to service_role;
create policy candidate_visibility_owner on public.candidate_visibility for select to authenticated using(user_id=(select auth.uid()));
create policy employer_application_owner on public.employer_applications for select to authenticated using(user_id=(select auth.uid()));
create policy employer_application_history_owner on public.employer_application_events for select to authenticated using(user_id=(select auth.uid()));

create function public.set_candidate_visibility(p_user uuid,p_version integer,p_discoverable boolean,p_contact boolean,p_resume uuid,p_anonymous boolean default false)
returns void language plpgsql security invoker set search_path='' as $$
declare current_version integer;
begin
  perform 1 from public.profiles where id=p_user for update;
  if not found or exists(select 1 from public.account_deletion_requests where user_id=p_user) then raise exception 'account_unavailable';end if;
  select version into current_version from public.candidate_visibility where user_id=p_user;
  if coalesce(current_version,0) is distinct from p_version then raise exception 'visibility_conflict';end if;
  if p_anonymous is null or p_discoverable is null or p_contact is null or (p_resume is not null and not exists(select 1 from public.resumes where id=p_resume and user_id=p_user and length(trim(raw_text)) between 1 and 250000)) then raise exception 'invalid_visibility';end if;
  insert into public.candidate_visibility(user_id,discoverable,share_contact,resume_id,anonymous)
    values(p_user,p_discoverable,p_discoverable and not p_anonymous and p_contact,case when p_discoverable and not p_anonymous then p_resume end,p_discoverable and p_anonymous)
    on conflict(user_id) do update set anonymous=excluded.anonymous,discoverable=excluded.discoverable,share_contact=excluded.share_contact,resume_id=excluded.resume_id,version=public.candidate_visibility.version+1,updated_at=now();
end $$;

create function public.submit_employer_application(p_user uuid,p_job uuid,p_resume uuid,p_note text,p_contact boolean,p_review jsonb default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare c public.recruiter_companies; j public.jobs; r public.resumes; p public.profiles; existing uuid; target uuid; email text;
begin
  select * into p from public.profiles where id=p_user for update;
  if p.id is null or exists(select 1 from public.account_deletion_requests where user_id=p_user) then raise exception 'account_unavailable';end if;
  select i.email into email from jobpilot_private.recruiter_identity(p_user) i where confirmed is not null;
  if email is null then raise exception 'confirm_email';end if;
  select * into c from public.recruiter_companies where id=(select recruiter_company_id from public.jobs where id=p_job) for update;
  select * into j from public.jobs where id=p_job for update;
  if c.id is null or c.user_id=p_user or c.verification_status<>'verified' or exists(select 1 from public.account_deletion_requests where user_id=c.user_id) or j.source<>'jobpilot' or j.posting_status<>'published' or (j.expires_at is not null and j.expires_at<=now()) or exists(select 1 from public.hidden_jobs where job_id=p_job) then raise exception 'job_unavailable';end if;
  select id into existing from public.employer_applications where user_id=p_user and job_id=p_job;
  if existing is not null then return existing;end if;
  if (select count(*) from public.employer_applications where user_id=p_user and submitted_at>now()-interval '24 hours')>=20 then raise exception 'application_limit';end if;
  select * into r from public.resumes where id=p_resume and user_id=p_user for share;
  if r.id is null or length(trim(coalesce(r.raw_text,''))) not between 1 and 250000 or length(trim(coalesce(p.full_name,''))) not between 1 and 200 or p_contact is null or p_note is null or length(p_note)>4000 then raise exception 'invalid_application';end if;
  if p_review is not null and (r.updated_at is distinct from (p_review->>'resume_updated_at')::timestamptz or p.updated_at is distinct from (p_review->>'profile_updated_at')::timestamptz or j.version is distinct from (p_review->>'job_version')::integer) then raise exception 'application_preview_changed';end if;
  insert into public.employer_applications(user_id,company_id,job_id,job_title,company_name,candidate_name,candidate_role,candidate_location,contact_email,resume_text,cover_note,match_score)
    values(p_user,c.id,j.id,j.title,c.name,p.full_name,left(p.target_role,200),left(p.location,300),case when p_contact then email end,r.raw_text,p_note,(p_review->>'match_score')::integer) returning id into target;
  insert into public.employer_application_events(application_id,user_id,actor,status,shortlisted,note) values(target,p_user,'Candidate','applied',false,'Candidate explicitly submitted a selected resume.');
  -- Private notes and stages remain independent. Only an absent tracker is initialized.
  insert into public.applications(user_id,job_id,status,resume_id,applied_at) values(p_user,p_job,'applied',p_resume,now()) on conflict(user_id,job_id) do nothing;
  return target;
end $$;

create function public.update_employer_application(p_user uuid,p_application uuid,p_version integer,p_status text,p_shortlisted boolean,p_note text,p_withdraw boolean)
returns void language plpgsql security invoker set search_path='' as $$
declare c public.recruiter_companies; a public.employer_applications;
begin
  if exists(select 1 from public.account_deletion_requests where user_id=p_user) or not exists(select 1 from public.profiles where id=p_user) then raise exception 'account_unavailable';end if;
  if p_withdraw is distinct from true then
    select * into c from public.recruiter_companies where id=(select company_id from public.employer_applications where id=p_application) and user_id=p_user for update;
    if c.id is null or c.verification_status<>'verified' then raise exception 'application_unavailable';end if;
  end if;
  select * into a from public.employer_applications where id=p_application for update;
  if a.id is null or (p_withdraw and a.user_id<>p_user) or (not p_withdraw and (a.company_id is distinct from c.id or exists(select 1 from public.account_deletion_requests where user_id=a.user_id))) then raise exception 'application_unavailable';end if;
  if a.version is distinct from p_version then raise exception 'application_conflict';end if;
  if p_withdraw is null or p_status is null or p_shortlisted is null or p_note is null or length(p_note)>1000 then raise exception 'invalid_application';end if;
  if p_withdraw then
    if p_status<>'withdrawn' or p_shortlisted then raise exception 'invalid_application';end if;
  elsif a.status in ('withdrawn','rejected','offer') or p_status not in ('applied','screening','interview','offer','rejected') or
    (a.status='screening' and p_status='applied') or (a.status='interview' and p_status in ('applied','screening')) then raise exception 'invalid_transition';end if;
  if a.status=p_status and a.shortlisted=p_shortlisted and p_note='' then return;end if;
  if not p_withdraw and (select count(*) from public.employer_application_events where application_id=a.id and actor='Verified recruiter' and created_at>now()-interval '24 hours')>=100 then raise exception 'review_limit';end if;
  update public.employer_applications set status=p_status,shortlisted=p_shortlisted,version=version+1,updated_at=now(),
    resume_text=case when p_withdraw then '' else resume_text end,contact_email=case when p_withdraw then null else contact_email end,
    cover_note=case when p_withdraw then '' else cover_note end where id=a.id;
  insert into public.employer_application_events(application_id,user_id,actor,status,shortlisted,note)
    values(a.id,a.user_id,case when p_withdraw then 'Candidate' else 'Verified recruiter' end,p_status,p_shortlisted,p_note);
end $$;

-- Recruiter access is checked again in the database and exposes no private tracker or file path.
create function public.get_recruiter_applications(p_user uuid,p_job uuid,p_status text,p_shortlisted boolean,p_offset integer,p_min_score integer default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.recruiter_companies; rows jsonb; counts jsonb; recent jsonb;
begin
  select * into c from public.recruiter_companies where user_id=p_user and verification_status='verified';
  if c.id is null or exists(select 1 from public.account_deletion_requests where user_id=p_user) then raise exception 'application_unavailable';end if;
  if p_min_score is not null and (p_min_score<0 or p_min_score>100) then raise exception 'invalid_application';end if;
  if p_offset is null or p_offset<0 or p_offset>100000 or (p_status is not null and p_status not in ('applied','screening','interview','offer','rejected','withdrawn')) then raise exception 'invalid_application';end if;
  select coalesce(jsonb_agg(to_jsonb(s)),'[]') into rows from (
    select a.id,a.user_id,a.job_id,a.job_title,a.candidate_name,a.candidate_role,a.candidate_location,a.match_score,a.status,a.shortlisted,a.version,a.submitted_at,a.updated_at from public.employer_applications a where a.company_id=c.id and not exists(select 1 from public.account_deletion_requests where user_id=a.user_id)
      and (p_job is null or a.job_id=p_job) and (p_status is null or a.status=p_status) and (p_shortlisted is null or a.shortlisted=p_shortlisted) and (p_min_score is null or a.match_score>=p_min_score)
      order by a.submitted_at desc,a.id limit 51 offset p_offset
  ) s;
  select coalesce(jsonb_object_agg(status,n),'{}') into counts from (select status,count(*) n from public.employer_applications a where company_id=c.id and not exists(select 1 from public.account_deletion_requests where user_id=a.user_id) group by status) s;
  select coalesce(jsonb_agg(to_jsonb(s)),'[]') into recent from (select e.id,e.actor,e.status,e.shortlisted,e.created_at,a.job_title from public.employer_application_events e join public.employer_applications a on a.id=e.application_id where a.company_id=c.id and not exists(select 1 from public.account_deletion_requests where user_id=a.user_id) order by e.id desc limit 10) s;
  return jsonb_build_object('applications',rows,'counts',counts,'recent_activity',recent);
end $$;

create function public.get_recruiter_application(p_user uuid,p_application uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  select to_jsonb(a)||jsonb_build_object('events',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from (select id,actor,status,shortlisted,note,created_at from public.employer_application_events where application_id=a.id order by id desc limit 50) s)) into result
    from public.employer_applications a join public.recruiter_companies c on c.id=a.company_id where a.id=p_application and c.user_id=p_user and c.verification_status='verified' and not exists(select 1 from public.account_deletion_requests where user_id in (p_user,a.user_id));
  return result;
end $$;
revoke all on function public.get_recruiter_application(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_recruiter_application(uuid,uuid) to service_role;

create function public.get_recruiter_candidate_profile(p_user uuid,p_candidate uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  if not exists(select 1 from public.recruiter_companies where user_id=p_user and verification_status='verified') or exists(select 1 from public.account_deletion_requests where user_id in (p_user,p_candidate)) then raise exception 'application_unavailable';end if;
  select jsonb_build_object('full_name',case when v.anonymous then 'Anonymous candidate' else p.full_name end,'target_role',p.target_role,'location',p.location,'experience_years',p.experience_years,
    'contact_email',case when v.share_contact then (select email from jobpilot_private.recruiter_identity(p_candidate) where confirmed is not null) end,
    'resume_text',case when v.resume_id is not null then r.raw_text end)
    into result from public.candidate_visibility v join public.profiles p on p.id=v.user_id left join public.resumes r on r.id=v.resume_id and r.user_id=v.user_id where v.user_id=p_candidate and v.discoverable;
  return result;
end $$;
revoke all on function public.set_candidate_visibility(uuid,integer,boolean,boolean,uuid,boolean),public.submit_employer_application(uuid,uuid,uuid,text,boolean,jsonb),public.update_employer_application(uuid,uuid,integer,text,boolean,text,boolean),public.get_recruiter_applications(uuid,uuid,text,boolean,integer,integer),public.get_recruiter_candidate_profile(uuid,uuid) from public,anon,authenticated;
grant execute on function public.set_candidate_visibility(uuid,integer,boolean,boolean,uuid,boolean),public.submit_employer_application(uuid,uuid,uuid,text,boolean,jsonb),public.update_employer_application(uuid,uuid,integer,text,boolean,text,boolean),public.get_recruiter_applications(uuid,uuid,text,boolean,integer,integer),public.get_recruiter_candidate_profile(uuid,uuid) to service_role;

-- Candidate owner RLS also scopes realtime updates.
alter publication supabase_realtime add table public.employer_applications;
