-- Reuse existing authenticated own-profile SELECT / UPDATE policies.
alter table public.profiles
  add column application_facts jsonb not null default '{}'::jsonb
  constraint application_facts_valid check (
    jsonb_typeof(application_facts) = 'object'
    and octet_length(application_facts::text) <= 16000
  );

-- TRUNCATE bypasses RLS and must not be available to browser roles.
revoke truncate on public.profiles from anon, authenticated;
