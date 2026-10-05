create table if not exists public.company_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_slug text not null check (length(trim(company_slug)) between 1 and 120),
  rating int not null check (rating between 1 and 5),
  work_life_rating int check (work_life_rating between 1 and 5),
  growth_rating int check (growth_rating between 1 and 5),
  culture_rating int check (culture_rating between 1 and 5),
  title text not null check (length(trim(title)) between 3 and 120),
  pros text not null check (length(trim(pros)) between 10 and 1000),
  cons text not null check (length(trim(cons)) between 10 and 1000),
  role_title text not null check (length(trim(role_title)) between 2 and 100),
  employment_status text not null check (employment_status in ('current', 'former', 'interviewee')),
  is_approved boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_reviews_user_slug_key unique (user_id, company_slug)
);

create index if not exists idx_company_reviews_slug on public.company_reviews(company_slug, created_at desc);
create index if not exists idx_company_reviews_user on public.company_reviews(user_id);

alter table public.company_reviews enable row level security;

revoke all on table public.company_reviews from anon;
grant select, insert, update, delete on table public.company_reviews to authenticated;
grant all on table public.company_reviews to service_role;

create policy company_reviews_select_approved on public.company_reviews
  for select to authenticated
  using (is_approved = true or user_id = (select auth.uid()));

create policy company_reviews_insert_own on public.company_reviews
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy company_reviews_update_own on public.company_reviews
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy company_reviews_delete_own on public.company_reviews
  for delete to authenticated
  using (user_id = (select auth.uid()));
