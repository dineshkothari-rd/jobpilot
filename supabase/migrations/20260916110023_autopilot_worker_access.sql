-- Server-only worker access; browser grants and ownership RLS remain unchanged.
grant select on public.profiles, public.job_preferences to service_role;
grant select, insert, update on public.jobs to service_role;
grant select, insert, delete on public.resumes to service_role;
grant select, insert on public.applications, public.saved_jobs to service_role;
