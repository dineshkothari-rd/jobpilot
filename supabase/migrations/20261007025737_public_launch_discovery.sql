-- Only this narrow, active projection may be used by anonymous-facing server pages.
-- No browser grants or candidate/recruiter private tables are exposed.
create view public.public_discovery_jobs with (security_invoker=true) as
select id,title,company_name,description,location,country,employment_type,seniority,
 salary_min,salary_max,salary_currency,skills,application_url,source_url,source,
 published_at,expires_at,recruiter_company_id,equity_min,equity_max
from public.moderated_jobs
where created_by is null and source in ('himalayas','remotive','arbeitnow','jobpilot')
 and (expires_at is null or expires_at>now());
revoke all on public.public_discovery_jobs from public,anon,authenticated;
grant select on public.public_discovery_jobs to service_role;
