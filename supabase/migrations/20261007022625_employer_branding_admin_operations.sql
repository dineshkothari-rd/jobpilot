create table public.employer_branding (
  company_id uuid primary key references public.recruiter_companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tagline text not null default '' check(length(tagline)<=240),
  about text not null default '' check(length(about)<=4000),
  culture text not null default '' check(length(culture)<=2000),
  perks text[] not null default '{}' check(cardinality(perks)<=20),
  tech_stack text[] not null default '{}' check(cardinality(tech_stack)<=30),
  leadership jsonb not null default '[]' check(jsonb_typeof(leadership)='array' and jsonb_array_length(leadership)<=10),
  banner_style text not null default 'blue' check(banner_style in ('blue','green','violet','slate')),
  published boolean not null default false,
  version integer not null default 1 check(version>0), updated_at timestamptz not null default now()
);
create table public.admin_account_cases (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null check(status in ('clear','review_needed','resolved')),
  notes text not null check(length(notes)<=4000),
  version integer not null default 1 check(version>0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table public.admin_operation_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  user_id uuid references auth.users(id) on delete cascade,
  status text not null, created_at timestamptz not null default clock_timestamp()
);
alter table public.employer_branding enable row level security;
alter table public.admin_account_cases enable row level security;
alter table public.admin_operation_events enable row level security;
revoke all on public.employer_branding,public.admin_account_cases,public.admin_operation_events from public,anon,authenticated;
grant select on public.employer_branding to authenticated;
grant all on public.employer_branding,public.admin_account_cases to service_role;
grant select,insert on public.admin_operation_events to service_role;
grant usage,select on sequence public.admin_operation_events_id_seq to service_role;
create policy branding_owner on public.employer_branding for select to authenticated using(user_id=(select auth.uid()));
create function public.save_employer_branding(p_user uuid,p_version integer,p_fields jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare company uuid; current_version integer; perks text[]; tech text[];
begin
  perform 1 from public.profiles where id=p_user for update;company:=public.hiring_company(p_user);
  select version into current_version from public.employer_branding where company_id=company;
  if coalesce(current_version,0) is distinct from p_version then raise exception 'application_conflict';end if;
  if p_fields is null or jsonb_typeof(p_fields->'perks')<>'array' or jsonb_typeof(p_fields->'tech_stack')<>'array' or jsonb_typeof(p_fields->'leadership')<>'array' or p_fields->>'published' not in ('true','false') then raise exception 'invalid_application';end if;
  select array_agg(value) into perks from jsonb_array_elements_text(p_fields->'perks');
  select array_agg(value) into tech from jsonb_array_elements_text(p_fields->'tech_stack');
  if exists(select 1 from unnest(perks||tech) value where length(value) not between 1 and 100) or exists(select 1 from jsonb_array_elements(p_fields->'leadership') value where jsonb_typeof(value)<>'object' or length(coalesce(value->>'name','')) not between 1 and 100 or length(coalesce(value->>'role','')) not between 1 and 100) then raise exception 'invalid_application';end if;
  insert into public.employer_branding(company_id,user_id,tagline,about,culture,perks,tech_stack,leadership,banner_style,published)
    values(company,p_user,p_fields->>'tagline',p_fields->>'about',p_fields->>'culture',coalesce(perks,'{}'),coalesce(tech,'{}'),p_fields->'leadership',p_fields->>'banner_style',(p_fields->>'published')::boolean)
    on conflict(company_id) do update set tagline=excluded.tagline,about=excluded.about,culture=excluded.culture,perks=excluded.perks,tech_stack=excluded.tech_stack,leadership=excluded.leadership,banner_style=excluded.banner_style,published=excluded.published,version=public.employer_branding.version+1,updated_at=now();
end $$;
create function public.get_employer_branding(p_company uuid) returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('company_id',c.id,'name',c.name,'website',c.website,'tagline',b.tagline,'about',b.about,'culture',b.culture,'perks',b.perks,'tech_stack',b.tech_stack,'leadership',b.leadership,'banner_style',b.banner_style)
  from public.employer_branding b join public.recruiter_companies c on c.id=b.company_id where c.id=p_company and c.verification_status='verified' and b.published and not exists(select 1 from public.account_deletion_requests where user_id=c.user_id)
$$;
create function public.get_admin_operations(p_user uuid,p_offset integer,p_query text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare accounts jsonb; counts jsonb;
begin
  if not exists(select 1 from jobpilot_private.recruiter_identity(p_user) where is_admin) or exists(select 1 from public.account_deletion_requests where user_id=p_user) or not exists(select 1 from public.profiles where id=p_user) then raise exception 'application_unavailable';end if;
  if p_offset is null or p_offset not between 0 and 100000 or length(p_query)>200 then raise exception 'invalid_application';end if;
  select jsonb_build_object('accounts',(select count(*) from public.profiles),'verified_companies',(select count(*) from public.recruiter_companies where verification_status='verified'),'published_jobs',(select count(*) from public.moderated_jobs where source='jobpilot'),'direct_applications',(select count(*) from public.employer_applications),'pending_verifications',(select count(*) from public.company_verification_requests where status='pending'),'pending_reports',(select count(*) from public.job_reports where status='pending'),'open_support',(select count(*) from public.support_tickets where status<>'resolved')) into counts;
  select coalesce(jsonb_agg(to_jsonb(s)),'[]') into accounts from (
    select p.id,p.full_name,i.email,p.target_role,p.created_at,coalesce(a.status,'clear') as case_status,coalesce(a.notes,'') as case_notes,coalesce(a.version,0) as case_version,
      exists(select 1 from public.account_deletion_requests where user_id=p.id) as deletion_pending
    from public.profiles p left join lateral jobpilot_private.recruiter_identity(p.id) i on true left join public.admin_account_cases a on a.user_id=p.id
    where p_query is null or position(lower(p_query) in lower(coalesce(p.full_name,'')||' '||coalesce(i.email,'')||' '||p.id::text))>0
    order by p.created_at desc,p.id limit 51 offset p_offset
  ) s;return jsonb_build_object('counts',counts,'accounts',accounts);
end $$;
create function public.save_admin_account_case(p_actor uuid,p_user uuid,p_version integer,p_status text,p_notes text) returns void language plpgsql security invoker set search_path='' as $$
declare current_version integer;
begin
  if not exists(select 1 from public.profiles where id=p_actor) or not exists(select 1 from jobpilot_private.recruiter_identity(p_actor) where is_admin) or exists(select 1 from public.account_deletion_requests where user_id in(p_actor,p_user)) then raise exception 'application_unavailable';end if;
  perform 1 from public.profiles where id=p_user for update;if not found then raise exception 'account_unavailable';end if;
  select version into current_version from public.admin_account_cases where user_id=p_user;
  if coalesce(current_version,0) is distinct from p_version then raise exception 'application_conflict';end if;
  if p_status is null or p_status not in ('clear','review_needed','resolved') or p_notes is null or length(p_notes)>4000 then raise exception 'invalid_application';end if;
  insert into public.admin_account_cases(user_id,status,notes,updated_by) values(p_user,p_status,p_notes,p_actor)
    on conflict(user_id) do update set status=excluded.status,notes=excluded.notes,updated_by=excluded.updated_by,version=public.admin_account_cases.version+1,updated_at=now();
  insert into public.admin_operation_events(actor_id,user_id,status) values(p_actor,p_user,p_status);
end $$;
revoke all on function public.save_employer_branding(uuid,integer,jsonb),public.get_employer_branding(uuid),public.get_admin_operations(uuid,integer,text),public.save_admin_account_case(uuid,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.save_employer_branding(uuid,integer,jsonb),public.get_employer_branding(uuid),public.get_admin_operations(uuid,integer,text),public.save_admin_account_case(uuid,uuid,integer,text,text) to service_role;
