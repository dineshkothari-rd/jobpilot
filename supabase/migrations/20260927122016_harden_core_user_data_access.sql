revoke all privileges on table
  public.profiles,
  public.job_preferences,
  public.resumes,
  public.saved_jobs,
  public.applications
from public, anon, authenticated;

grant select, insert, update on public.profiles, public.job_preferences to authenticated;
grant select, insert, update, delete on public.resumes to authenticated;
grant select, insert, delete on public.saved_jobs to authenticated;
grant select, insert, update on public.applications to authenticated;

grant select, insert, update, delete on table
  public.profiles,
  public.job_preferences,
  public.resumes,
  public.saved_jobs,
  public.applications
to service_role;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists job_preferences_all_own on public.job_preferences;
create policy job_preferences_all_own on public.job_preferences for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists resumes_all_own on public.resumes;
create policy resumes_all_own on public.resumes for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists saved_jobs_all_own on public.saved_jobs;
create policy saved_jobs_all_own on public.saved_jobs for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists applications_all_own on public.applications;
create policy applications_all_own on public.applications for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
