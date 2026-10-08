create table public.billing_products (
 id text primary key,name text not null,kind text not null check(kind in ('subscription','posting_pack')),
 plan_id text references public.launch_plans(id),amount_minor integer not null check(amount_minor between 100 and 10000000),currency text not null default 'INR' check(currency='INR'),
 credits integer not null default 0 check(credits between 0 and 1000),check((kind='subscription' and plan_id is not null and credits=0) or (kind='posting_pack' and plan_id is null and credits>0))
);
insert into public.billing_products(id,name,kind,plan_id,amount_minor,credits) values
 ('candidate_pro','Candidate Pro monthly','subscription','candidate_pro',29900,0),('recruiter_starter','Recruiter Starter monthly','subscription','recruiter_starter',99900,0),('recruiter_growth','Recruiter Growth monthly','subscription','recruiter_growth',249900,0),('recruiter_enterprise','Recruiter Enterprise monthly','subscription','recruiter_enterprise',599900,0),
 ('posting_single','One posting credit','posting_pack',null,49900,1),('posting_five','Five posting credits','posting_pack',null,199900,5),('posting_twenty','Twenty posting credits','posting_pack',null,699900,20);
create table public.billing_policy(singleton boolean primary key default true check(singleton),paid_access boolean not null default false);
insert into public.billing_policy values(true,false);
create table public.billing_intents (
 id uuid primary key,user_id uuid references auth.users(id) on delete set null,product_id text not null references public.billing_products(id),mode text not null check(mode in ('test','live')),
 amount_minor integer not null check(amount_minor>0),credits integer not null default 0,provider_resource text unique,provider_plan text,checkout_url text,status text not null default 'creating',
 credits_granted boolean not null default false,lease_token uuid,lease_until timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index billing_intents_owner on public.billing_intents(user_id,created_at desc);
create table public.billing_payments (
 id text primary key,intent_id uuid not null references public.billing_intents(id),user_id uuid references auth.users(id) on delete set null,
 amount_minor integer not null check(amount_minor>0),refunded_minor integer not null default 0 check(refunded_minor>=0 and refunded_minor<=amount_minor),paid_at timestamptz not null,invoice_url text
);
create index billing_payments_owner on public.billing_payments(user_id,paid_at desc);
create table public.billing_entitlements(user_id uuid references auth.users(id) on delete cascade,mode text check(mode in ('test','live')),plan_id text not null references public.launch_plans(id),intent_id uuid not null references public.billing_intents(id),expires_at timestamptz not null,active boolean not null,primary key(user_id,mode));
create table public.posting_credit_balance(user_id uuid references auth.users(id) on delete cascade,mode text check(mode in ('test','live')),balance integer not null default 0,primary key(user_id,mode));
create table public.posting_credit_spends(job_id uuid primary key references public.jobs(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now());
create table public.billing_events(id text primary key,intent_id uuid not null references public.billing_intents(id),processed_at timestamptz not null default now());
do $$ declare t text;begin
 foreach t in array array['billing_products','billing_policy','billing_intents','billing_payments','billing_entitlements','posting_credit_balance','posting_credit_spends','billing_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to service_role',t);
 end loop;
 foreach t in array array['billing_intents','billing_payments','billing_entitlements','posting_credit_balance','posting_credit_spends'] loop
 execute format('create policy billing_owner_read on public.%I for select to authenticated using(user_id=(select auth.uid()))',t);
 execute format('create policy active_account_required on public.%I as restrictive for all to authenticated using((select jobpilot_private.current_account_is_active())) with check((select jobpilot_private.current_account_is_active()))',t);
 end loop;
end $$;
grant select on public.billing_products,public.billing_policy to anon,authenticated;
create policy products_read on public.billing_products for select to anon,authenticated using(true);
create policy policy_read on public.billing_policy for select to anon,authenticated using(true);
grant select(id,user_id,product_id,mode,amount_minor,provider_resource,status,created_at,updated_at) on public.billing_intents to authenticated;
grant select on public.billing_payments,public.billing_entitlements,public.posting_credit_balance,public.posting_credit_spends to authenticated;
create function public.begin_billing_checkout(p_user uuid,p_id uuid,p_product text,p_mode text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare prior public.billing_intents; product public.billing_products;
begin
 perform 1 from public.profiles where id=p_user for update;
 if not found or not jobpilot_private.account_is_active(p_user) or exists(select 1 from public.account_deletion_requests where user_id=p_user) then raise exception 'account_unavailable';end if;
 if p_mode is null or p_mode not in ('test','live') or p_id is null then raise exception 'invalid_checkout';end if;
 select * into product from public.billing_products where id=p_product;
 if product.id is null then raise exception 'invalid_checkout';end if;
 if (product.kind='posting_pack' or product.plan_id like 'recruiter_%') and not exists(select 1 from public.recruiter_companies where user_id=p_user and verification_status='verified') then raise exception 'company_not_verified';end if;
 select * into prior from public.billing_intents where id=p_id;
 if prior.id is not null and (prior.user_id is distinct from p_user or prior.product_id is distinct from p_product or prior.mode is distinct from p_mode) then raise exception 'checkout_conflict';end if;
 if prior.id is null then select * into prior from public.billing_intents where user_id=p_user and product_id=p_product and mode=p_mode and status in ('creating','created','authenticated','pending','active','halted') order by created_at desc limit 1;end if;
 if prior.id is not null then return to_jsonb(prior)||jsonb_build_object('new',false);end if;
 if product.kind='subscription' and exists(select 1 from public.billing_intents i join public.billing_products p on p.id=i.product_id where i.user_id=p_user and i.mode=p_mode and p.kind='subscription' and i.status not in ('cancelled','completed','expired')) then raise exception 'subscription_exists';end if;
 if (select count(*) from public.billing_intents where user_id=p_user and created_at>now()-interval '1 day')>=10 then raise exception 'checkout_limit';end if;
 insert into public.billing_intents(id,user_id,product_id,mode,amount_minor,credits) values(p_id,p_user,p_product,p_mode,product.amount_minor,product.credits) returning * into prior;
 return to_jsonb(prior)||jsonb_build_object('new',true);
end $$;
create function public.claim_billing_event(p_intent uuid,p_token uuid,p_event text) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if p_token is null or p_event is null or length(p_event) not between 8 and 200 then raise exception 'invalid_event';end if;
 if exists(select 1 from public.billing_events where id=p_event) then return false;end if;
 update public.billing_intents set lease_token=p_token,lease_until=now()+interval '2 minutes' where id=p_intent and provider_resource is not null and (lease_until is null or lease_until<now());
 if not found then raise exception 'billing_busy';end if;return true;
end $$;
create function public.apply_billing_snapshot(p_intent uuid,p_token uuid,p_event text,p_status text,p_payment text,p_amount integer,p_refunded integer,p_paid_at timestamptz,p_expires timestamptz,p_invoice text) returns void language plpgsql security invoker set search_path='' as $$
declare i public.billing_intents; product public.billing_products; had_refund boolean:=false; grant_credits boolean;
begin
 select * into i from public.billing_intents where id=p_intent for update;
 if i.id is null or i.lease_token is distinct from p_token or i.lease_until<=now() then raise exception 'billing_busy';end if;
 if exists(select 1 from public.billing_events where id=p_event) then return;end if;
 select * into product from public.billing_products where id=i.product_id;
 if p_status is null or p_status not in ('created','authenticated','active','pending','halted','paused','cancelled','completed','expired','paid','failed','refunded') then raise exception 'invalid_event';end if;
 if p_payment is not null then
 if p_payment !~ '^pay_[a-zA-Z0-9]+$' or p_amount is distinct from i.amount_minor or p_refunded is null or p_refunded<0 or p_refunded>p_amount or p_paid_at is null or p_paid_at>now()+interval '5 minutes' or (p_invoice is not null and p_invoice !~ '^https://rzp\.io/') then raise exception 'invalid_payment';end if;
 if exists(select 1 from public.billing_payments where id=p_payment and intent_id<>i.id) then raise exception 'payment_conflict';end if;
 select refunded_minor>0 into had_refund from public.billing_payments where id=p_payment;
 insert into public.billing_payments(id,intent_id,user_id,amount_minor,refunded_minor,paid_at,invoice_url) values(p_payment,i.id,i.user_id,p_amount,p_refunded,p_paid_at,p_invoice)
 on conflict(id) do update set refunded_minor=greatest(public.billing_payments.refunded_minor,excluded.refunded_minor),invoice_url=coalesce(excluded.invoice_url,public.billing_payments.invoice_url);
 end if;
 if product.kind='posting_pack' and i.user_id is not null then
 grant_credits:=p_status='paid' and p_payment is not null and p_refunded=0 and not coalesce(had_refund,false);
 if grant_credits and not i.credits_granted then
 insert into public.posting_credit_balance(user_id,mode,balance) values(i.user_id,i.mode,i.credits) on conflict(user_id,mode) do update set balance=public.posting_credit_balance.balance+excluded.balance;
 update public.billing_intents set credits_granted=true where id=i.id;
 elsif i.credits_granted and (p_refunded>0 or p_status='refunded') then
 -- ponytail: refunded spent credits become debt; future purchases offset it before new posts.
 update public.posting_credit_balance set balance=balance-i.credits where user_id=i.user_id and mode=i.mode;
 update public.billing_intents set credits_granted=false where id=i.id;
 end if;
 end if;
 if product.kind='subscription' and i.user_id is not null then
 if p_payment is not null and p_refunded=0 and not coalesce(had_refund,false) and p_status='active' then
 if p_expires is null or p_expires>now()+interval '45 days' then raise exception 'invalid_period';end if;
 if p_expires>now() then
 insert into public.billing_entitlements(user_id,mode,plan_id,intent_id,expires_at,active) values(i.user_id,i.mode,product.plan_id,i.id,p_expires,true)
 on conflict(user_id,mode) do update set plan_id=excluded.plan_id,intent_id=excluded.intent_id,expires_at=case when public.billing_entitlements.intent_id=excluded.intent_id then greatest(public.billing_entitlements.expires_at,excluded.expires_at) else excluded.expires_at end,active=true;
 end if;
 elsif p_refunded>0 or p_status in ('paused','halted','pending','failed','refunded','expired') then update public.billing_entitlements set active=false where user_id=i.user_id and mode=i.mode and intent_id=i.id;
 end if;
 end if;
 update public.billing_intents set status=p_status,lease_token=null,lease_until=null,updated_at=now() where id=i.id;
 insert into public.billing_events(id,intent_id) values(p_event,i.id);
end $$;
revoke all on function public.begin_billing_checkout(uuid,uuid,text,text),public.claim_billing_event(uuid,uuid,text),public.apply_billing_snapshot(uuid,uuid,text,text,text,integer,integer,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.begin_billing_checkout(uuid,uuid,text,text),public.claim_billing_event(uuid,uuid,text),public.apply_billing_snapshot(uuid,uuid,text,text,text,integer,integer,timestamptz,timestamptz,text) to service_role;
alter table public.candidate_visibility add column featured boolean not null default false;

create or replace function public.effective_launch_plan(p_user uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; paid jsonb;
begin
 if not jobpilot_private.account_is_active(p_user) or not exists(select 1 from public.profiles where id=p_user) or exists(select 1 from public.account_deletion_requests where user_id=p_user) then raise exception 'account_unavailable';end if;
 select jsonb_build_object('id',p.id,'name',p.name,'expires_at',a.expires_at,'limits',jsonb_build_object('autopilot',p.autopilot,'candidate_search',p.candidate_search,'interview_ai',p.interview_ai,'active_postings',p.active_postings)) into result
 from public.launch_plan_assignments a join public.launch_plans p on p.id=a.plan_id where a.user_id=p_user and a.expires_at>now() and (p.audience='candidate' or exists(select 1 from public.recruiter_companies where user_id=p_user and verification_status='verified'));
 select jsonb_build_object('id',p.id,'name',p.name,'expires_at',a.expires_at,'limits',jsonb_build_object('autopilot',p.autopilot,'candidate_search',p.candidate_search,'interview_ai',p.interview_ai,'active_postings',p.active_postings)) into paid
 from public.billing_entitlements a join public.launch_plans p on p.id=a.plan_id where a.user_id=p_user and a.mode='live' and a.active and a.expires_at>now() and (p.audience='candidate' or exists(select 1 from public.recruiter_companies where user_id=p_user and verification_status='verified'));
 if paid is not null then result:=paid;end if;
 if result is null then select jsonb_build_object('id','free_launch','name','Free launch','expires_at',null,'limits',jsonb_object_agg(meter,limit_value)) into result from public.launch_limits;end if;
 return result;
end $$;

drop function public.set_candidate_visibility(uuid,integer,boolean,boolean,uuid,boolean);
create function public.set_candidate_visibility(p_user uuid,p_version integer,p_discoverable boolean,p_contact boolean,p_resume uuid,p_anonymous boolean default false,p_featured boolean default false)
returns void language plpgsql security invoker set search_path='' as $$
declare current_version integer;
begin
  perform 1 from public.profiles where id=p_user for update;
  if not found or not jobpilot_private.account_is_active(p_user) or exists(select 1 from public.account_deletion_requests where user_id=p_user) then raise exception 'account_unavailable';end if;
  select version into current_version from public.candidate_visibility where user_id=p_user;
  if coalesce(current_version,0) is distinct from p_version then raise exception 'visibility_conflict';end if;
  if p_featured is null or p_anonymous is null or p_discoverable is null or p_contact is null or (p_resume is not null and not exists(select 1 from public.resumes where id=p_resume and user_id=p_user and length(trim(raw_text)) between 1 and 250000)) then raise exception 'invalid_visibility';end if;
  insert into public.candidate_visibility(user_id,discoverable,share_contact,resume_id,anonymous,featured)
    values(p_user,p_discoverable,p_discoverable and not p_anonymous and p_contact,case when p_discoverable and not p_anonymous then p_resume end,p_discoverable and p_anonymous,p_featured and p_discoverable and not p_anonymous)
    on conflict(user_id) do update set featured=excluded.featured,anonymous=excluded.anonymous,discoverable=excluded.discoverable,share_contact=excluded.share_contact,resume_id=excluded.resume_id,version=public.candidate_visibility.version+1,updated_at=now();
end $$;
revoke all on function public.set_candidate_visibility(uuid,integer,boolean,boolean,uuid,boolean,boolean) from public,anon,authenticated;
grant execute on function public.set_candidate_visibility(uuid,integer,boolean,boolean,uuid,boolean,boolean) to service_role;

create function public.recruiter_database_allowed(p_user uuid) returns boolean language plpgsql stable security invoker set search_path='' as $$
begin
 if not jobpilot_private.account_is_active(p_user) then return false;end if;
 if not coalesce((select paid_access from public.billing_policy where singleton),true) then return true;end if;
 return public.effective_launch_plan(p_user)->>'id' like 'recruiter_%';
end $$;
revoke all on function public.recruiter_database_allowed(uuid) from public,anon,authenticated;
grant execute on function public.recruiter_database_allowed(uuid) to service_role;

create or replace function public.hiring_contact_allowed(p_company uuid,p_candidate uuid) returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from public.recruiter_companies c where c.id=p_company and c.verification_status='verified' and c.user_id<>p_candidate
    and not exists(select 1 from public.account_deletion_requests where user_id in(c.user_id,p_candidate))
    and exists(select 1 from public.profiles where id=p_candidate)
    and (exists(select 1 from public.employer_applications a where a.company_id=c.id and a.user_id=p_candidate and a.status not in ('withdrawn','rejected'))
      or public.recruiter_database_allowed(c.user_id) and exists(select 1 from public.candidate_visibility v where v.user_id=p_candidate and v.discoverable and not v.anonymous)))
$$;

create or replace function public.search_hiring_candidates(p_user uuid,p_role text,p_location text,p_skill text,p_experience integer,p_offset integer,p_shortlists boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare company uuid:=public.hiring_company(p_user); result jsonb;
begin
  if not public.recruiter_database_allowed(p_user) then raise exception 'database_plan_required';end if;
  if p_offset is null or p_offset not between 0 and 100000 or p_experience is not null and p_experience not between 0 and 80 or greatest(length(p_role),length(p_location),length(p_skill))>100 or p_shortlists is null then raise exception 'invalid_application';end if;
  -- ponytail: parameterized substring matching over opted-in skills; use a search index when pilot inventory warrants it.
  select coalesce(jsonb_agg(to_jsonb(s)),'[]') into result from (
    select p.id,case when v.anonymous then 'Anonymous candidate' else p.full_name end as full_name,p.target_role,p.location,p.experience_years,
      coalesce(r.parsed_data->'skills','{}'::jsonb) as skills,v.anonymous,
      v.featured and not v.anonymous and public.effective_launch_plan(p.id)->>'id'='candidate_pro' as featured,
      l.id as shortlist_id,l.status as shortlist_status,l.notes as shortlist_notes,coalesce(l.version,0) as shortlist_version
    from public.candidate_visibility v join public.profiles p on p.id=v.user_id left join public.resumes r on r.id=v.resume_id and r.user_id=v.user_id
      left join public.recruiter_shortlists l on l.company_id=company and l.candidate_id=p.id
    where jobpilot_private.account_is_active(p.id) and v.discoverable and p.id<>p_user and not exists(select 1 from public.account_deletion_requests where user_id=p.id)
      and (not p_shortlists or l.id is not null)
      and (p_role is null or position(lower(p_role) in lower(coalesce(p.target_role,'')))>0)
      and (p_location is null or position(lower(p_location) in lower(coalesce(p.location,'')))>0)
      and (p_skill is null or position(lower(p_skill) in lower(coalesce((r.parsed_data->'skills')::text,'')))>0)
      and (p_experience is null or p.experience_years>=p_experience)
    order by (v.featured and not v.anonymous and public.effective_launch_plan(p.id)->>'id'='candidate_pro') desc,v.updated_at desc,p.id limit 51 offset p_offset
  ) s;return result;
end $$;

create or replace function public.get_recruiter_candidate_profile(p_user uuid,p_candidate uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if not public.recruiter_database_allowed(p_user) then raise exception 'database_plan_required';end if;
  if not exists(select 1 from public.recruiter_companies where user_id=p_user and verification_status='verified') or exists(select 1 from public.account_deletion_requests where user_id in (p_user,p_candidate)) then raise exception 'application_unavailable';end if;
  select jsonb_build_object('full_name',case when v.anonymous then 'Anonymous candidate' else p.full_name end,'target_role',p.target_role,'location',p.location,'experience_years',p.experience_years,
    'contact_email',case when v.share_contact then (select email from jobpilot_private.recruiter_identity(p_candidate) where confirmed is not null) end,
    'resume_text',case when v.resume_id is not null then r.raw_text end)
    into result from public.candidate_visibility v join public.profiles p on p.id=v.user_id left join public.resumes r on r.id=v.resume_id and r.user_id=v.user_id where v.user_id=p_candidate and v.discoverable and jobpilot_private.account_is_active(p_candidate);
  return result;
end $$;

alter table public.posting_credit_spends alter constraint posting_credit_spends_job_id_fkey deferrable initially deferred;
create or replace function public.save_recruiter_job(p_user uuid,p_company uuid,p_job uuid,p_version integer,p_fields jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare c public.recruiter_companies; j public.jobs; target uuid:=coalesce(p_job,gen_random_uuid()); next_status text:=p_fields->>'posting_status'; posting_limit integer;
begin
  select * into c from public.recruiter_companies where id=p_company and user_id=p_user for update;
  if c.id is null or not jobpilot_private.account_is_active(p_user) or exists(select 1 from public.account_deletion_requests where user_id=p_user) then raise exception 'recruiter_required';end if;
  if next_status='published' and c.verification_status<>'verified' then raise exception 'company_not_verified';end if;
  if p_job is not null then
    select * into j from public.jobs where id=p_job and recruiter_company_id=c.id and source='jobpilot' for update;
    if j.id is null or j.version is distinct from p_version then raise exception 'posting_conflict';end if;
    if j.posting_status='closed' and next_status<>'closed' then raise exception 'posting_closed';end if;
  else
    if p_version is distinct from 0 or next_status<>'draft' then raise exception 'draft_required';end if;
    select (public.effective_launch_plan(p_user)->'limits'->>'active_postings')::integer into posting_limit;
    if posting_limit is null then raise exception 'allowance_unavailable';end if;
    if (select count(*) from public.jobs where recruiter_company_id=c.id and posting_status<>'closed')>=posting_limit then raise exception 'posting_limit';end if;
  end if;
  if next_status='published' and j.published_at is null and coalesce((select paid_access from public.billing_policy where singleton),true) and not exists(select 1 from public.posting_credit_spends where job_id=target) then
 update public.posting_credit_balance set balance=balance-1 where user_id=p_user and mode='live' and balance>0;
 if not found then raise exception 'posting_credit_required';end if;
 insert into public.posting_credit_spends(job_id,user_id) values(target,p_user);
 end if;
  insert into public.jobs(id,external_id,source,recruiter_company_id,company_name,title,description,location,country,employment_type,seniority,salary_min,salary_max,salary_currency,skills,application_url,posting_status,equity_min,equity_max,published_at,expires_at)
  values(target,'jobpilot:'||target,'jobpilot',c.id,c.name,p_fields->>'title',p_fields->>'description',p_fields->>'location',p_fields->>'country',p_fields->>'employment_type',p_fields->>'seniority',nullif(p_fields->>'salary_min','')::integer,nullif(p_fields->>'salary_max','')::integer,p_fields->>'salary_currency',array(select jsonb_array_elements_text(p_fields->'skills')),p_fields->>'application_url',next_status,nullif(p_fields->>'equity_min','')::numeric,nullif(p_fields->>'equity_max','')::numeric,case when next_status='published' then coalesce(j.published_at,now()) else j.published_at end,case when next_status in ('closed','paused') then now() else null end)
  on conflict(id) do update set title=excluded.title,description=excluded.description,location=excluded.location,country=excluded.country,employment_type=excluded.employment_type,seniority=excluded.seniority,salary_min=excluded.salary_min,salary_max=excluded.salary_max,salary_currency=excluded.salary_currency,skills=excluded.skills,application_url=excluded.application_url,posting_status=excluded.posting_status,equity_min=excluded.equity_min,equity_max=excluded.equity_max,published_at=excluded.published_at,expires_at=excluded.expires_at,version=public.jobs.version+1;
  if next_status='published' and j.published_at is null then update public.jobs set alert_available_at=now() where id=target;end if;
  return target;
end $$;
