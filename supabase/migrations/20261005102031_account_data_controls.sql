-- A durable marker freezes resume uploads while deletion is retried.
create table public.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now()
);
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public, anon, authenticated;
grant select on public.account_deletion_requests to authenticated;
grant select, insert, update, delete on public.account_deletion_requests to service_role;
create policy account_deletion_requests_owner_read on public.account_deletion_requests
for select to authenticated using (user_id = (select auth.uid()));

-- Retained JWTs cannot upload after their profile has been deleted, either.
create policy resume_objects_active_account on storage.objects as restrictive
for insert to authenticated with check (
  bucket_id <> 'resumes' or (
    exists(select 1 from public.profiles where id = (select auth.uid()))
    and not exists(select 1 from public.account_deletion_requests where user_id = (select auth.uid()))
  )
);

-- User-added jobs are private to their owner and must not block account deletion.
alter table public.jobs drop constraint jobs_created_by_fkey;
alter table public.jobs add constraint jobs_created_by_fkey
foreign key(created_by) references auth.users(id) on delete cascade;

-- Admin claims in an already-issued JWT must not outlive the account.
create policy reports_active_account on public.job_reports as restrictive
for all to authenticated
using (exists(select 1 from public.profiles where id = (select auth.uid())))
with check (
  exists(select 1 from public.profiles where id = (select auth.uid()))
  and not exists(select 1 from public.account_deletion_requests where user_id = (select auth.uid()))
);
create policy hidden_confirm_active_account on public.hidden_jobs as restrictive
for insert to authenticated with check (
  exists(select 1 from public.profiles where id = (select auth.uid()))
  and not exists(select 1 from public.account_deletion_requests where user_id = (select auth.uid()))
);
create policy jobs_read_active_account on public.jobs as restrictive
for select to authenticated using (
  exists(select 1 from public.profiles where id = (select auth.uid()))
);
