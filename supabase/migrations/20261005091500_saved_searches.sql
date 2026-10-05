create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  criteria jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_saved_searches_user on public.saved_searches(user_id, updated_at desc);

alter table public.saved_searches enable row level security;

revoke all on table public.saved_searches from anon;
grant select, insert, update, delete on table public.saved_searches to authenticated;
grant all on table public.saved_searches to service_role;

create policy saved_searches_select_own on public.saved_searches
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy saved_searches_insert_own on public.saved_searches
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy saved_searches_update_own on public.saved_searches
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy saved_searches_delete_own on public.saved_searches
  for delete to authenticated
  using (user_id = (select auth.uid()));
