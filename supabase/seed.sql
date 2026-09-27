-- Deterministic local-only fixtures used by Supabase security tests.

insert into auth.users (
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-4000-8000-000000000010',
  'authenticated',
  'authenticated',
  'jobpilot-security-owner@example.invalid',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"JobPilot Security Owner"}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.jobs (
  id,
  external_id,
  title,
  company_name,
  application_url,
  source_url,
  source,
  raw_data
)
values (
  '00000000-0000-4000-8000-000000000020',
  'security-fixture-job',
  'Security Fixture Job',
  'JobPilot Test',
  'https://example.invalid/jobs/security-fixture',
  'https://example.invalid/jobs/security-fixture',
  'himalayas',
  '{}'::jsonb
)
on conflict (id) do nothing;

insert into public.applications (
  id,
  user_id,
  job_id,
  status
)
values (
  '00000000-0000-4000-8000-000000000030',
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000020',
  'saved'
)
on conflict (id) do nothing;

-- Secondary account used to verify cross-user RLS isolation.
insert into auth.users (
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'jobpilot-security-other@example.invalid',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"JobPilot Security Other"}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;
