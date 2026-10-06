-- One independently reviewed company per owner. Requesting recruiter access grants no publishing authority.
create table public.recruiter_companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null check(length(trim(name)) between 2 and 200),
  domain text not null check(length(domain) between 4 and 253 and domain=lower(domain) and domain ~ '^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$'),
  contact_name text not null check(length(trim(contact_name)) between 2 and 100),
  contact_email text not null check(length(contact_email) between 3 and 254),
  corporate_email_verified boolean not null default false,
  website text not null check(length(website)<=2048 and website ~ '^https://'),
  verification_status text not null default 'pending' check(verification_status in ('pending','verified','rejected','revoked')),
  version integer not null default 1 check(version>0),
  created_at timestamptz not null default now()
);
create unique index verified_company_domain on public.recruiter_companies(domain) where verification_status='verified';
create table public.company_verification_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.recruiter_companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  evidence_url text not null check(length(evidence_url)<=2048 and evidence_url ~ '^https://'),
  details text not null check(length(trim(details)) between 20 and 2000),
  status text not null default 'pending' check(status in ('pending','approved','rejected','revoked')),
  review_note text check(length(review_note)<=2000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  version integer not null default 1 check(version>0),
  created_at timestamptz not null default now()
);
create index company_verification_queue on public.company_verification_requests(status,created_at);
create index company_verification_owner on public.company_verification_requests(user_id,created_at);
create unique index company_verification_pending on public.company_verification_requests(company_id) where status='pending';
alter table public.recruiter_companies enable row level security;
alter table public.company_verification_requests enable row level security;
revoke all on public.recruiter_companies,public.company_verification_requests from public,anon,authenticated;
grant select on public.recruiter_companies,public.company_verification_requests to authenticated;
grant all on public.recruiter_companies,public.company_verification_requests to service_role;
create policy recruiter_company_owner on public.recruiter_companies for select to authenticated using(user_id=(select auth.uid()));
create policy verification_owner on public.company_verification_requests for select to authenticated using(user_id=(select auth.uid()));
alter table public.jobs add column recruiter_company_id uuid references public.recruiter_companies(id) on delete set null,
  add column posting_status text not null default 'published' check(posting_status in ('draft','published','paused','closed')),
  add column equity_min numeric,
  add column equity_max numeric,
  add constraint direct_job_identity check((source='jobpilot' and (recruiter_company_id is not null or posting_status='closed') and created_by is null) or (source<>'jobpilot' and recruiter_company_id is null and posting_status='published' and equity_min is null and equity_max is null)),
  add constraint direct_job_bounds check(source<>'jobpilot' or (
    length(trim(title)) between 2 and 200 and length(coalesce(description,'')) between 50 and 10000 and
    length(coalesce(location,'')) between 1 and 300 and cardinality(skills) between 1 and 30 and
    coalesce(application_url,'') ~ '^https://' and length(application_url)<=2048 and
    (salary_min is null or salary_min>=0) and (salary_max is null or salary_max>=coalesce(salary_min,0)) and
    ((salary_min is null and salary_max is null) or (salary_currency is not null and salary_currency in ('INR','USD','EUR','GBP','CAD','AUD'))) and
    ((equity_min is null and equity_max is null) or (equity_min is not null and equity_max is not null and equity_min>=0 and equity_max>=equity_min and equity_max<=100))
  ));
create index jobs_recruiter_company on public.jobs(recruiter_company_id,posting_status);
-- A narrow private helper exposes only verification state, never corporate contacts or evidence.
create function jobpilot_private.is_verified_company(p_company uuid) returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid()) and exists(select 1 from public.recruiter_companies where id=p_company and verification_status='verified')
$$;
revoke all on function jobpilot_private.is_verified_company(uuid) from public,anon;
grant usage on schema jobpilot_private to authenticated;
grant execute on function jobpilot_private.is_verified_company(uuid) to authenticated;
drop policy jobs_select_visible on public.jobs;
create policy jobs_select_visible on public.jobs for select to authenticated using (
  ((source<>'jobpilot' and (created_by is null or created_by=(select auth.uid()))) or
   (source='jobpilot' and posting_status='published' and jobpilot_private.is_verified_company(recruiter_company_id))) and
  ((select auth.jwt()->'app_metadata'->>'role')='admin' or not exists(select 1 from public.hidden_jobs h where h.job_id=jobs.id))
);
create or replace view public.moderated_jobs with(security_invoker=true) as select j.* from public.jobs j
  where not exists(select 1 from public.hidden_jobs h where h.job_id=j.id)
    and (j.source<>'jobpilot' or (j.posting_status='published' and exists(select 1 from public.recruiter_companies c where c.id=j.recruiter_company_id and c.verification_status='verified')));
revoke all on public.moderated_jobs from public,anon,authenticated;
grant select on public.moderated_jobs to service_role;

-- Service-only lookup of the minimum Auth identity fields; no broad auth.users grants.
create function jobpilot_private.recruiter_identity(p_user uuid)
returns table(email text,confirmed timestamptz,is_admin boolean) language sql stable security definer set search_path='' as $$
  select u.email,u.email_confirmed_at,coalesce(u.raw_app_meta_data->>'role'='admin',false) from auth.users u where u.id=p_user
$$;
revoke all on function jobpilot_private.recruiter_identity(uuid) from public,anon,authenticated;
grant usage on schema jobpilot_private to service_role;
grant execute on function jobpilot_private.recruiter_identity(uuid) to service_role;

create function public.register_recruiter(p_user uuid,p_name text,p_domain text,p_contact text,p_website text,p_evidence text,p_details text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare company uuid; email text; confirmed timestamptz;
begin
  select i.email,i.confirmed into email,confirmed from jobpilot_private.recruiter_identity(p_user) i;
  if email is null or confirmed is null or exists(select 1 from public.account_deletion_requests where user_id=p_user) then raise exception 'recruiter_confirm_email';end if;
  insert into public.recruiter_companies(user_id,name,domain,contact_name,contact_email,corporate_email_verified,website)
    values(p_user,p_name,p_domain,p_contact,email,split_part(lower(email),'@',2)=p_domain,p_website) returning id into company;
  insert into public.company_verification_requests(company_id,user_id,evidence_url,details) values(company,p_user,p_evidence,p_details);
  return company;
end $$;
create function public.request_company_verification(p_user uuid,p_company uuid,p_version integer,p_evidence text,p_details text)
returns void language plpgsql security invoker set search_path='' as $$
declare c public.recruiter_companies;
begin
  select * into c from public.recruiter_companies where id=p_company and user_id=p_user for update;
  if c.id is null or c.version is distinct from p_version or c.verification_status not in ('rejected','revoked') or exists(select 1 from public.account_deletion_requests where user_id=p_user) then raise exception 'verification_conflict';end if;
  if (select count(*) from public.company_verification_requests where user_id=p_user and created_at>now()-interval '24 hours')>=3 then raise exception 'verification_limit';end if;
  update public.recruiter_companies set verification_status='pending',version=version+1 where id=c.id;
  insert into public.company_verification_requests(company_id,user_id,evidence_url,details) values(c.id,p_user,p_evidence,p_details);
end $$;
create function public.review_company_verification(p_admin uuid,p_request uuid,p_version integer,p_decision text,p_note text)
returns void language plpgsql security invoker set search_path='' as $$
declare r public.company_verification_requests;
begin
  if not exists(select 1 from jobpilot_private.recruiter_identity(p_admin) where is_admin) or exists(select 1 from public.account_deletion_requests where user_id=p_admin) then raise exception 'admin_required';end if;
  if p_decision is null or p_decision not in ('approved','rejected','revoked') or length(trim(coalesce(p_note,''))) not between 10 and 2000 then raise exception 'invalid_decision';end if;
  select * into r from public.company_verification_requests where id=p_request for update;
  if r.id is null or r.version is distinct from p_version or (p_decision='revoked' and r.status<>'approved') or (p_decision<>'revoked' and r.status<>'pending') then raise exception 'verification_conflict';end if;
  perform 1 from public.recruiter_companies where id=r.company_id for update;
  if exists(select 1 from public.account_deletion_requests where user_id=r.user_id) then raise exception 'verification_conflict';end if;
  update public.company_verification_requests set status=p_decision,review_note=p_note,reviewed_by=p_admin,reviewed_at=now(),version=version+1 where id=r.id;
  update public.recruiter_companies set verification_status=case p_decision when 'approved' then 'verified' when 'rejected' then 'rejected' else 'revoked' end,version=version+1 where id=r.company_id;
  if p_decision='revoked' then update public.jobs set posting_status='paused',version=version+1 where recruiter_company_id=r.company_id and posting_status='published';end if;
end $$;

create function public.save_recruiter_job(p_user uuid,p_company uuid,p_job uuid,p_version integer,p_fields jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare c public.recruiter_companies; j public.jobs; target uuid:=coalesce(p_job,gen_random_uuid()); next_status text:=p_fields->>'posting_status';
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
    if (select count(*) from public.jobs where recruiter_company_id=c.id and posting_status<>'closed')>=100 then raise exception 'posting_limit';end if;
  end if;
  insert into public.jobs(id,external_id,source,recruiter_company_id,company_name,title,description,location,country,employment_type,seniority,salary_min,salary_max,salary_currency,skills,application_url,posting_status,equity_min,equity_max,published_at,expires_at)
  values(target,'jobpilot:'||target,'jobpilot',c.id,c.name,p_fields->>'title',p_fields->>'description',p_fields->>'location',p_fields->>'country',p_fields->>'employment_type',p_fields->>'seniority',nullif(p_fields->>'salary_min','')::integer,nullif(p_fields->>'salary_max','')::integer,p_fields->>'salary_currency',array(select jsonb_array_elements_text(p_fields->'skills')),p_fields->>'application_url',next_status,nullif(p_fields->>'equity_min','')::numeric,nullif(p_fields->>'equity_max','')::numeric,case when next_status='published' then coalesce(j.published_at,now()) else j.published_at end,case when next_status in ('closed','paused') then now() else null end)
  on conflict(id) do update set title=excluded.title,description=excluded.description,location=excluded.location,country=excluded.country,employment_type=excluded.employment_type,seniority=excluded.seniority,salary_min=excluded.salary_min,salary_max=excluded.salary_max,salary_currency=excluded.salary_currency,skills=excluded.skills,application_url=excluded.application_url,posting_status=excluded.posting_status,equity_min=excluded.equity_min,equity_max=excluded.equity_max,published_at=excluded.published_at,expires_at=excluded.expires_at,version=public.jobs.version+1;
  if next_status='published' and j.published_at is null then update public.jobs set alert_available_at=now() where id=target;end if;
  return target;
end $$;
revoke all on function public.register_recruiter(uuid,text,text,text,text,text,text),public.request_company_verification(uuid,uuid,integer,text,text),public.review_company_verification(uuid,uuid,integer,text,text),public.save_recruiter_job(uuid,uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.register_recruiter(uuid,text,text,text,text,text,text),public.request_company_verification(uuid,uuid,integer,text,text),public.review_company_verification(uuid,uuid,integer,text,text),public.save_recruiter_job(uuid,uuid,uuid,integer,jsonb) to service_role;

-- Preserve other candidates' application/history foreign keys when an employer deletes their account.
create function jobpilot_private.remove_recruiter_posting_data() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.jobs set posting_status='closed',expires_at=now(),version=version+1,
    title='Removed job posting',company_name=null,description='This listing was removed after its employer account was deleted.',
    location='Not available',country=null,employment_type=null,seniority=null,salary_min=null,salary_max=null,salary_currency=null,
    equity_min=null,equity_max=null,skills=array['Not available'],application_url='https://example.invalid/removed',source_url=null,raw_data='{}'
    where recruiter_company_id=old.id;
  return old;
end $$;
revoke all on function jobpilot_private.remove_recruiter_posting_data() from public,anon,authenticated;
create trigger recruiter_posting_cleanup before delete on public.recruiter_companies for each row execute function jobpilot_private.remove_recruiter_posting_data();
