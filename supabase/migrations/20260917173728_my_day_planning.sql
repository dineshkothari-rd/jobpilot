create table public.my_day_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}' check (jsonb_typeof(preferences) = 'object' and octet_length(preferences::text) <= 16000),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);
alter table public.my_day_preferences enable row level security;
revoke all on public.my_day_preferences from public, anon, authenticated;
grant select, insert, update on public.my_day_preferences to authenticated;
grant select, insert, update, delete on public.my_day_preferences to service_role;
create policy "Read own daily plan" on public.my_day_preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own daily plan" on public.my_day_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own daily plan" on public.my_day_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
