create table public.application_interviews (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  round text not null check (length(trim(round)) between 1 and 120),
  starts_at timestamptz not null,
  timezone text not null check (length(timezone) between 1 and 100),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  location text not null default '' check (length(location) <= 1000),
  notes text not null default '' check (length(notes) <= 5000),
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  outcome text not null default '' check (length(outcome) <= 2000),
  version integer not null default 1 check (version > 0)
);
create index application_interviews_owner_time on public.application_interviews(user_id, starts_at);
create index application_interviews_application on public.application_interviews(application_id);
alter table public.application_interviews enable row level security;
revoke all on public.application_interviews from public, anon, authenticated;
grant select, insert, update on public.application_interviews to authenticated;
grant select, insert, update, delete on public.application_interviews to service_role;
create policy interviews_select_own on public.application_interviews for select to authenticated
  using ((select auth.uid()) = user_id and exists (select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid())));
create policy interviews_insert_own on public.application_interviews for insert to authenticated
  with check ((select auth.uid()) = user_id and exists (select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid())));
create policy interviews_update_own on public.application_interviews for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid())));
