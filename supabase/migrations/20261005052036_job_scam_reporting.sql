create table public.job_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('payment','impersonation','phishing','misleading','other')),
  details text not null check (length(trim(details)) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending','confirmed','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text check (length(review_note) <= 2000),
  unique (job_id, user_id)
);
create index job_reports_queue on public.job_reports(status, created_at);
create index job_reports_user_created on public.job_reports(user_id, created_at);
alter table public.job_reports enable row level security;
revoke all on public.job_reports from anon, authenticated;
grant select on public.job_reports to authenticated;
grant insert (job_id,user_id,category,details) on public.job_reports to authenticated;
grant update (status,reviewed_at,reviewed_by,review_note) on public.job_reports to authenticated;
grant all on public.job_reports to service_role;
create policy reports_read on public.job_reports for select to authenticated
  using (user_id = (select auth.uid()) or (select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy reports_submit on public.job_reports for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending'
    and exists (select 1 from public.jobs j where j.id = job_id));
create policy reports_moderate on public.job_reports for update to authenticated
  using ((select auth.jwt()->'app_metadata'->>'role') = 'admin' and status = 'pending')
  with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin'
    and status in ('confirmed','dismissed') and reviewed_by = (select auth.uid()) and reviewed_at is not null);

-- Only public hide decisions are shared; reporter identity/details remain private.
create table public.hidden_jobs (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  confirmed_at timestamptz not null default now()
);
alter table public.hidden_jobs enable row level security;
revoke all on public.hidden_jobs from anon, authenticated;
grant select, insert on public.hidden_jobs to authenticated;
grant all on public.hidden_jobs to service_role;
create policy hidden_read on public.hidden_jobs for select to authenticated using (true);
create policy hidden_confirm on public.hidden_jobs for insert to authenticated
  with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

create function public.enforce_job_report() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 37));
    if exists (select 1 from public.job_reports where user_id = new.user_id and job_id = new.job_id) then return new; end if;
    if (select count(*) from public.job_reports where user_id = new.user_id and created_at >= now() - interval '24 hours') >= 10 then
      raise exception 'Daily report limit reached' using errcode = 'P0001';
    end if;
  elsif new.status = 'confirmed' then
    insert into public.hidden_jobs(job_id) values(new.job_id) on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_job_report() from public, anon, authenticated;
create trigger job_report_limit before insert on public.job_reports for each row execute function public.enforce_job_report();
create trigger job_report_confirm after update on public.job_reports for each row execute function public.enforce_job_report();

drop policy jobs_select_visible on public.jobs;
create policy jobs_select_visible on public.jobs for select to authenticated using (
  (created_by is null or created_by = (select auth.uid())) and
  ((select auth.jwt()->'app_metadata'->>'role') = 'admin' or
   not exists (select 1 from public.hidden_jobs h where h.job_id = jobs.id))
);
-- Service-role Autopilot reads bypass RLS, so its feed must explicitly hide confirmed scams.
create view public.moderated_jobs with (security_invoker = true) as
  select j.* from public.jobs j where not exists (select 1 from public.hidden_jobs h where h.job_id = j.id);
revoke all on public.moderated_jobs from public, anon, authenticated;
grant select on public.moderated_jobs to service_role;
