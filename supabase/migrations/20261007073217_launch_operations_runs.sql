create table public.worker_runs (
  id uuid primary key default gen_random_uuid(),
  worker text not null check(worker in ('autopilot','reminders','job_alerts')),
  state text not null default 'running' check(state in ('running','succeeded','failed','skipped','incomplete','abandoned')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  completed integer not null default 0 check(completed>=0),
  failed integer not null default 0 check(failed>=0),
  skipped integer not null default 0 check(skipped>=0),
  check ((state='running' and finished_at is null) or (state<>'running' and finished_at is not null))
);
create index worker_runs_recent on public.worker_runs(worker,started_at desc,id);
alter table public.worker_runs enable row level security;
revoke all on public.worker_runs from public,anon,authenticated;
grant select,insert,update,delete on public.worker_runs to service_role;

create function public.begin_worker_run(p_worker text) returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
  if p_worker not in ('autopilot','reminders','job_alerts') or p_worker is null then raise exception 'invalid_worker';end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('jobpilot/worker/'||p_worker));
  if exists(select 1 from public.worker_runs where worker=p_worker and state='running' and started_at>now()-interval '10 minutes') then return null;end if;
  update public.worker_runs set state='abandoned',finished_at=now() where worker=p_worker and state='running';
  insert into public.worker_runs(worker) values(p_worker) returning id into result;
  -- ponytail: retain 200 bounded runs per worker; external archives only if longer retention is needed.
  delete from public.worker_runs where worker=p_worker and id in(select id from public.worker_runs where worker=p_worker order by started_at desc,id desc offset 200);
  return result;
end $$;
create function public.finish_worker_run(p_id uuid,p_state text,p_completed integer,p_failed integer,p_skipped integer) returns boolean language plpgsql security invoker set search_path='' as $$
begin
  if p_state is null or p_state not in ('succeeded','failed','skipped','incomplete') or p_completed is null or p_failed is null or p_skipped is null or least(p_completed,p_failed,p_skipped)<0 then raise exception 'invalid_worker_result';end if;
  update public.worker_runs set state=p_state,finished_at=now(),completed=p_completed,failed=p_failed,skipped=p_skipped where id=p_id and state='running';
  return found;
end $$;
revoke all on function public.begin_worker_run(text),public.finish_worker_run(uuid,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.begin_worker_run(text),public.finish_worker_run(uuid,text,integer,integer,integer) to service_role;
