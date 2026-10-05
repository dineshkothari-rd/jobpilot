create table if not exists public.company_follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_slug text not null check (length(trim(company_slug)) between 1 and 120),
  company_name text not null check (length(trim(company_name)) between 1 and 200),
  notify_new_openings boolean not null default true,
  created_at timestamptz not null default now(),
  constraint company_follows_user_slug_key unique (user_id, company_slug)
);

create index if not exists idx_company_follows_user on public.company_follows(user_id, created_at desc);
create index if not exists idx_company_follows_slug on public.company_follows(company_slug);

alter table public.company_follows enable row level security;

revoke all on table public.company_follows from anon;
grant select, insert, update, delete on table public.company_follows to authenticated;
grant all on table public.company_follows to service_role;

create policy company_follows_select_own on public.company_follows
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy company_follows_insert_own on public.company_follows
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy company_follows_update_own on public.company_follows
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy company_follows_delete_own on public.company_follows
  for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.get_company_follower_count(slug text)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::bigint
  from public.company_follows
  where company_slug = slug;
$$;

revoke all on function public.get_company_follower_count(text) from public;
grant execute on function public.get_company_follower_count(text) to authenticated, anon;
