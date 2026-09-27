create table public.interview_practice_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id text,
  role text not null check (length(role) between 1 and 120),
  topic text not null check (topic in ('frontend', 'react', 'javascript', 'backend', 'sql')),
  mode text not null check (mode in ('technical', 'behavioral', 'mixed')),
  minutes integer not null check (minutes in (10,20,30)),
  questions jsonb not null check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) between 1 and 7 and octet_length(questions::text) <= 64000),
  answers jsonb not null default '{}' check (jsonb_typeof(answers) = 'object' and octet_length(answers::text) <= 700000),
  current_index integer not null default 0 check (current_index >= 0 and current_index < jsonb_array_length(questions)),
  status text not null default 'active' check (status in ('active', 'complete')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index interview_practice_owner_updated on public.interview_practice_sessions (user_id, updated_at desc);
alter table public.interview_practice_sessions enable row level security;
revoke all on public.interview_practice_sessions from public, anon, authenticated;
grant select on public.interview_practice_sessions to authenticated;
grant select, insert, update, delete on public.interview_practice_sessions to service_role;
create policy "Own interview practice only" on public.interview_practice_sessions for select to authenticated using ((select auth.uid()) = user_id);
