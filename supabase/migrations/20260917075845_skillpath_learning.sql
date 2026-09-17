-- Local proposal: apply only after approval. Catalogue and answer keys remain in reviewed source code.
create table public.skillpath_enrollments (
  user_id uuid not null references auth.users(id) on delete cascade,
  path_id text not null check (length(path_id) between 1 and 64),
  version integer not null default 1 check (version > 0),
  completed text[] not null default '{}' check (cardinality(completed) <= 100),
  bookmarks text[] not null default '{}' check (cardinality(bookmarks) <= 100),
  notes jsonb not null default '{}' check (jsonb_typeof(notes) = 'object' and octet_length(notes::text) <= 16000),
  selected_lesson text not null check (length(selected_lesson) <= 64),
  minutes_per_day integer not null default 30 check (minutes_per_day between 10 and 180),
  target_role text not null default '' check (length(target_role) <= 120),
  project_url text not null default '' check (length(project_url) <= 2000),
  project_summary text not null default '' check (length(project_summary) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (user_id, path_id)
);

create table public.skillpath_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  path_id text not null,
  score integer not null check (score between 0 and 100),
  answers integer[] not null check (cardinality(answers) between 1 and 20),
  created_at timestamptz not null default now(),
  foreign key (user_id, path_id) references public.skillpath_enrollments(user_id, path_id) on delete cascade
);
create index skillpath_attempts_owner_path on public.skillpath_attempts(user_id, path_id, created_at desc);

create table public.skillpath_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('external', 'jobpilot')),
  path_id text,
  title text not null check (length(title) between 1 and 180),
  issuer text not null check (length(issuer) between 1 and 120),
  issued_on date not null,
  expires_on date,
  verification_url text not null default '' check (length(verification_url) <= 2000),
  credential_ref text not null default '' check (length(credential_ref) <= 180),
  public_name text not null default '' check (length(public_name) <= 120),
  is_public boolean not null default false,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_on is null or expires_on >= issued_on),
  check ((kind = 'jobpilot' and path_id is not null and issuer = 'JobPilot') or (kind = 'external' and path_id is null and not is_public)),
  unique (user_id, path_id)
);

-- Clients can only read their own rows. All writes use authenticated, owner-scoped
-- server routes, so clients cannot forge assessment scores or certificate eligibility.
alter table public.skillpath_enrollments enable row level security;
alter table public.skillpath_attempts enable row level security;
alter table public.skillpath_credentials enable row level security;
revoke all on public.skillpath_enrollments, public.skillpath_attempts, public.skillpath_credentials from public, anon, authenticated;
grant select on public.skillpath_enrollments, public.skillpath_attempts, public.skillpath_credentials to authenticated;
grant select, insert, update, delete on public.skillpath_enrollments, public.skillpath_attempts, public.skillpath_credentials to service_role;
create policy "Own learning only" on public.skillpath_enrollments for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own assessment history only" on public.skillpath_attempts for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own credentials only" on public.skillpath_credentials for select to authenticated using ((select auth.uid()) = user_id);
