-- Version matches production migration history.
-- One active run per user, shared by manual runs and the free daily worker.
create unique index if not exists automation_actions_one_active_run_idx
  on public.automation_actions (user_id)
  where status = 'running' and action_type in ('autopilot_run', 'scheduled_autopilot_run');

-- Background worker uses a server-only key; browser grants and ownership RLS stay unchanged.
grant select, insert, update, delete on public.autopilot_preferences to service_role;
grant select, insert, update, delete on public.automation_actions to service_role;
grant select, insert, update, delete on public.application_submissions to service_role;

-- No supported submission provider exists in the free assisted flow.
update public.autopilot_preferences set auto_submit = false where auto_submit = true;
