create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  target_role text,
  experience_years numeric,
  location text,
  github_url text,
  linkedin_url text,
  portfolio_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  current_company text
);

create table public.job_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  preferred_roles text[] not null default '{}',
  preferred_locations text[] not null default '{}',
  remote_only boolean not null default false,
  employment_types text[] not null default '{full-time}',
  minimum_match_score integer not null default 70
    check (minimum_match_score between 0 and 100),
  minimum_salary integer,
  preferred_countries text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_path text,
  file_size bigint,
  mime_type text,
  raw_text text,
  parsed_data jsonb not null default '{}'::jsonb,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  title text not null,
  company_name text,
  description text,
  location text,
  country text,
  employment_type text,
  seniority text,
  salary_min integer,
  salary_max integer,
  salary_currency text,
  timezone text,
  application_url text,
  source_url text,
  source text not null default 'himalayas',
  published_at timestamptz,
  skills text[] not null default '{}',
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.saved_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  status text not null default 'applied'
    check (
      status in (
        'saved',
        'applied',
        'screening',
        'interview',
        'offer',
        'rejected',
        'withdrawn'
      )
    ),
  applied_at timestamptz,
  notes text,
  resume_id uuid references public.resumes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  follow_up_at timestamptz,
  unique (user_id, job_id)
);

create index applications_status_idx
  on public.applications(status);

create index applications_user_id_idx
  on public.applications(user_id);

create index jobs_company_name_idx
  on public.jobs(company_name);

create index jobs_country_idx
  on public.jobs(country);

create index jobs_published_at_idx
  on public.jobs(published_at desc);

create index jobs_source_idx
  on public.jobs(source);

create index saved_jobs_user_id_idx
  on public.saved_jobs(user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    email,
    avatar_url
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger job_preferences_set_updated_at
before update on public.job_preferences
for each row execute function public.set_updated_at();

create trigger resumes_set_updated_at
before update on public.resumes
for each row execute function public.set_updated_at();

create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

create trigger applications_set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
