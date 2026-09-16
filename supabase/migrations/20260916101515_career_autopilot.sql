-- Version matches the migration applied to production Supabase.
create table if not exists public.autopilot_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  target_roles text[] not null default '{}',
  locations text[] not null default '{}',
  workplace_modes text[] not null default '{}',
  salary_min numeric check (salary_min is null or salary_min >= 0),
  salary_max numeric check (salary_max is null or salary_max >= 0),
  work_authorization text not null default '',
  notice_period text not null default '',
  preferred_companies text[] not null default '{}',
  blocked_companies text[] not null default '{}',
  industries text[] not null default '{}',
  daily_limit integer not null default 5 check (daily_limit between 1 and 50),
  match_threshold integer not null default 70 check (match_threshold between 0 and 100),
  auto_submit boolean not null default false,
  updated_at timestamptz not null default now(),
  check (salary_min is null or salary_max is null or salary_max >= salary_min)
);

create table if not exists public.automation_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null,
  job_id uuid references public.jobs(id) on delete set null,
  resume_id uuid references public.resumes(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  status text not null check (status in ('pending', 'running', 'completed', 'failed', 'skipped', 'needs_user_confirmation')),
  reason text not null default '',
  error_message text,
  proof_url text,
  retry_count integer not null default 0 check (retry_count >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (
    (status in ('pending', 'running') and completed_at is null)
    or
    (status not in ('pending', 'running') and completed_at is not null)
  )
);

create table if not exists public.application_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  resume_id uuid references public.resumes(id) on delete set null,
  automation_action_id uuid references public.automation_actions(id) on delete set null,
  mode text not null check (mode in ('automatic', 'assisted', 'review')),
  status text not null check (status in ('prepared', 'submitted', 'failed', 'skipped', 'needs_review')),
  cover_note text,
  application_answers jsonb not null default '[]'::jsonb
    check (jsonb_typeof(application_answers) = 'array'),
  checklist text[] not null default '{}',
  application_url text,
  proof_url text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id),
  check (application_url is null or application_url ~ '^https://'),
  check (
    status <> 'submitted'
    or (
      submitted_at is not null
      and proof_url is not null
      and proof_url ~ '^https://'
    )
  )
);

alter table public.autopilot_preferences enable row level security;
alter table public.automation_actions enable row level security;
alter table public.application_submissions enable row level security;

create policy autopilot_preferences_own on public.autopilot_preferences for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy automation_actions_own on public.automation_actions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy application_submissions_own on public.application_submissions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.autopilot_preferences to authenticated;
grant select, insert, update, delete on public.automation_actions to authenticated;
grant select, insert, update, delete on public.application_submissions to authenticated;

create index if not exists automation_actions_user_created_idx
  on public.automation_actions (user_id, created_at desc);
create index if not exists automation_actions_user_status_idx
  on public.automation_actions (user_id, status);
create index if not exists automation_actions_job_idx
  on public.automation_actions (job_id) where job_id is not null;
create index if not exists automation_actions_resume_idx
  on public.automation_actions (resume_id) where resume_id is not null;
create index if not exists automation_actions_application_idx
  on public.automation_actions (application_id) where application_id is not null;
create index if not exists application_submissions_user_status_idx
  on public.application_submissions (user_id, status);
create index if not exists application_submissions_job_idx
  on public.application_submissions (job_id);
create index if not exists application_submissions_resume_idx
  on public.application_submissions (resume_id) where resume_id is not null;
create index if not exists application_submissions_action_idx
  on public.application_submissions (automation_action_id)
  where automation_action_id is not null;
