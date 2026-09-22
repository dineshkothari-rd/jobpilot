create table public.portfolio_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 180),
  problem text not null default '' check (length(problem) <= 2000),
  contribution text not null check (length(trim(contribution)) between 20 and 5000),
  outcome text not null default '' check (length(outcome) <= 2000),
  skills text[] not null default '{}' check (cardinality(skills) <= 30 and length(array_to_string(skills, '')) <= 3000),
  evidence_url text not null default '' check (evidence_url = '' or evidence_url ~ '^https://'),
  source_kind text not null default 'manual' check (source_kind in ('manual', 'learning')),
  source_ref text check (source_ref is null or length(source_ref) <= 100),
  reviewed_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((source_kind = 'manual' and source_ref is null) or (source_kind = 'learning' and source_ref is not null and length(source_ref) > 0))
);

create index portfolio_evidence_owner_updated on public.portfolio_evidence(user_id, updated_at desc);
create unique index portfolio_evidence_learning_source on public.portfolio_evidence(user_id, source_ref) where source_kind = 'learning';

alter table public.portfolio_evidence enable row level security;
revoke all on table public.portfolio_evidence from anon, authenticated;
grant select, insert, update, delete on table public.portfolio_evidence to authenticated;
grant select, insert, update, delete on table public.portfolio_evidence to service_role;

create policy portfolio_evidence_select_own on public.portfolio_evidence for select to authenticated
  using (user_id = (select auth.uid()));
create policy portfolio_evidence_insert_own on public.portfolio_evidence for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy portfolio_evidence_update_own on public.portfolio_evidence for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy portfolio_evidence_delete_own on public.portfolio_evidence for delete to authenticated
  using (user_id = (select auth.uid()));
