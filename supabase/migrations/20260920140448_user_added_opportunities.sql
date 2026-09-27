alter table public.jobs
  add column created_by uuid references auth.users(id) on delete restrict,
  add column expires_at timestamptz,
  add column version integer not null default 1 check (version > 0),
  add constraint jobs_user_source_owner check (created_by is null or source = 'user'),
  add constraint jobs_user_field_bounds check (
    source <> 'user' or (
      length(trim(title)) between 1 and 200 and
      length(coalesce(company_name, '')) between 1 and 200 and
      length(coalesce(description, '')) <= 10000 and
      length(coalesce(location, '')) <= 300 and
      length(coalesce(country, '')) <= 100 and
      length(coalesce(employment_type, '')) <= 100 and
      cardinality(skills) <= 30 and
      application_url ~ '^https://'
    )
  );
create unique index jobs_owner_application_url on public.jobs(created_by, application_url) where created_by is not null;
create index jobs_owner_published on public.jobs(created_by, published_at desc) where created_by is not null;

drop policy if exists "Authenticated users can insert jobs" on public.jobs;
drop policy if exists "Authenticated users can update himalayas jobs" on public.jobs;
drop policy if exists "Authenticated users can view jobs" on public.jobs;
revoke all on table public.jobs from anon, authenticated;
grant select, insert, update on table public.jobs to authenticated;
grant select, insert, update, delete on table public.jobs to service_role;
create policy jobs_select_visible on public.jobs for select to authenticated
  using (created_by is null or created_by = (select auth.uid()));
create policy jobs_insert_own on public.jobs for insert to authenticated
  with check (source = 'user' and created_by = (select auth.uid()) and raw_data = '{}'::jsonb);
create policy jobs_update_own on public.jobs for update to authenticated
  using (source = 'user' and created_by = (select auth.uid()))
  with check (source = 'user' and created_by = (select auth.uid()) and raw_data = '{}'::jsonb);
