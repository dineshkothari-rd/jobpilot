begin;
select plan(1);
set local role service_role;
do $$ declare first_run uuid; next_run uuid;
begin
 first_run:=public.begin_worker_run('reminders');
 if first_run is null or public.begin_worker_run('reminders') is not null then raise exception 'Worker overlap allowed';end if;
 if not public.finish_worker_run(first_run,'succeeded',2,0,0) or public.finish_worker_run(first_run,'failed',0,1,0) then raise exception 'Run completion not protected';end if;
 first_run:=public.begin_worker_run('reminders');
 update public.worker_runs set started_at=now()-interval '11 minutes' where id=first_run;
 next_run:=public.begin_worker_run('reminders');
 if next_run is null or not exists(select 1 from public.worker_runs where id=first_run and state='abandoned') or public.finish_worker_run(first_run,'succeeded',1,0,0) then raise exception 'Stale worker overwrote completion';end if;
 perform public.finish_worker_run(next_run,'incomplete',1,1,0);
 begin perform public.begin_worker_run('forged');raise exception 'Invalid worker accepted';exception when raise_exception then if sqlerrm<>'invalid_worker' then raise;end if;end;
 begin perform public.finish_worker_run(next_run,'succeeded',-1,0,0);raise exception 'Negative count accepted';exception when raise_exception then if sqlerrm<>'invalid_worker_result' then raise;end if;end;
 insert into public.worker_runs(worker,state,started_at,finished_at) select 'autopilot','succeeded',now()-interval '1 day',now() from generate_series(1,205);
 perform public.begin_worker_run('autopilot');
 if (select count(*) from public.worker_runs where worker='autopilot')<>200 then raise exception 'Retention unbounded';end if;
end $$;
set local role anon;
do $$ begin
 begin perform 1 from public.worker_runs;raise exception 'Public operations readable';exception when insufficient_privilege then null;end;
 begin perform public.begin_worker_run('reminders');raise exception 'Public claim allowed';exception when insufficient_privilege then null;end;
end $$;
set local role authenticated;
do $$ begin
 begin perform 1 from public.worker_runs;raise exception 'Browser operations readable';exception when insufficient_privilege then null;end;
 begin perform public.finish_worker_run(gen_random_uuid(),'succeeded',1,0,0);raise exception 'Browser finish allowed';exception when insufficient_privilege then null;end;
end $$;
select pass('Worker monitoring is service-only, bounded, serialized and protects stale/final runs');
select * from finish();
rollback;
