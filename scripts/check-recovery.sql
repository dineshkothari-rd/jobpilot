-- Read-only acceptance snapshot for an ISOLATED restored database.
-- Compare counts with the backup-time snapshot; passing schema checks alone is not recovery certification.
select jsonb_build_object(
  'checks',jsonb_build_object(
    'private_tables_have_rls', (select count(*)=8 and bool_and(c.relrowsecurity)
      from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in ('profiles','resumes','applications','application_interviews','employer_applications','calendar_tokens','worker_runs','support_tickets')),
    'server_tables_deny_browser_select',not exists(
      select 1 from (values('public.calendar_tokens'),('public.worker_runs')) as t(name)
      where pg_catalog.has_table_privilege('anon',t.name,'SELECT') or pg_catalog.has_table_privilege('authenticated',t.name,'SELECT')),
    'public_projection_excludes_private_or_expired',not exists(select 1 from public.public_discovery_jobs d
      join public.jobs j on j.id=d.id where j.created_by is not null or j.expires_at<=now()),
    'no_unvalidated_application_foreign_keys',not exists(select 1 from pg_catalog.pg_constraint
      where contype='f' and conrelid in ('public.applications'::regclass,'public.application_interviews'::regclass,'public.employer_applications'::regclass) and not convalidated)
  ),
  'counts',jsonb_build_object(
    'profiles',(select count(*) from public.profiles),
    'resumes',(select count(*) from public.resumes),
    'applications',(select count(*) from public.applications),
    'interviews',(select count(*) from public.application_interviews),
    'employer_applications',(select count(*) from public.employer_applications),
    'support_tickets',(select count(*) from public.support_tickets)
  )
) as recovery_snapshot;
