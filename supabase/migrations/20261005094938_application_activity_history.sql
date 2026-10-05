create table public.application_events (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('created', 'snapshot', 'updated')),
  changes jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
create index application_events_application_history on public.application_events(application_id, id desc);
alter table public.application_events enable row level security;
revoke all on public.application_events from anon, authenticated, service_role;
grant select on public.application_events to authenticated, service_role;
create policy application_events_owner_read on public.application_events for select to authenticated
  using (user_id = (select auth.uid()));

-- Existing records are current-state snapshots, not reconstructed history.
insert into public.application_events(application_id, user_id, kind, changes)
select id, user_id, 'snapshot', jsonb_build_object(
  'status', jsonb_build_object('from', null, 'to', status),
  'notes', jsonb_build_object('from', null, 'to', notes),
  'follow_up_at', jsonb_build_object('from', null, 'to', follow_up_at),
  'resume_id', jsonb_build_object('from', null, 'to', resume_id),
  'applied_at', jsonb_build_object('from', null, 'to', applied_at)
) from public.applications;

create schema if not exists jobpilot_private;
revoke all on schema jobpilot_private from public, anon, authenticated;
create function jobpilot_private.record_application_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  field text;
  before_row jsonb;
  after_row jsonb := to_jsonb(new);
  changes jsonb := '{}'::jsonb;
begin
  if tg_op = 'UPDATE' then before_row := to_jsonb(old); end if;
  foreach field in array array['status', 'notes', 'follow_up_at', 'resume_id', 'applied_at'] loop
    if tg_op = 'INSERT' or (before_row -> field) is distinct from (after_row -> field) then
      changes := changes || jsonb_build_object(field, jsonb_build_object('from', before_row -> field, 'to', after_row -> field));
    end if;
  end loop;
  if changes <> '{}'::jsonb then
    insert into public.application_events(application_id, user_id, actor_id, kind, changes)
    values (new.id, new.user_id, auth.uid(), case when tg_op = 'INSERT' then 'created' else 'updated' end, changes);
  end if;
  return new;
end $$;
revoke all on function jobpilot_private.record_application_event() from public, anon, authenticated, service_role;
create trigger application_activity_history after insert or update on public.applications
for each row execute function jobpilot_private.record_application_event();
