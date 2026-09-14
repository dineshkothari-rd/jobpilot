do $$
begin
  if to_regclass('public.profiles') is not null then
    alter table public.profiles enable row level security;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_own') then
      create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_insert_own') then
      create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own') then
      create policy profiles_update_own on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
    end if;
  end if;

  if to_regclass('public.job_preferences') is not null then
    alter table public.job_preferences enable row level security;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_preferences' and policyname = 'job_preferences_all_own') then
      create policy job_preferences_all_own on public.job_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
    end if;
  end if;

  if to_regclass('public.resumes') is not null then
    alter table public.resumes enable row level security;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'resumes' and policyname = 'resumes_all_own') then
      create policy resumes_all_own on public.resumes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
    end if;
  end if;

  if to_regclass('public.saved_jobs') is not null then
    alter table public.saved_jobs enable row level security;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_jobs' and policyname = 'saved_jobs_all_own') then
      create policy saved_jobs_all_own on public.saved_jobs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
    end if;
  end if;

  if to_regclass('public.applications') is not null then
    alter table public.applications enable row level security;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'applications' and policyname = 'applications_all_own') then
      create policy applications_all_own on public.applications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
    end if;
  end if;
end $$;
