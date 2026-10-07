begin;
select plan(1);
select set_config('jobpilot.test.actor',(select id::text from auth.users order by created_at limit 1),true);
select set_config('jobpilot.test.target',(select id::text from auth.users order by created_at limit 1 offset 1),true);
update auth.users set email_confirmed_at=now(),raw_app_meta_data=jsonb_set(coalesce(raw_app_meta_data,'{}'),'{role}','"admin"') where id=current_setting('jobpilot.test.actor')::uuid;
update auth.users set email_confirmed_at=now(),raw_app_meta_data=jsonb_set(coalesce(raw_app_meta_data,'{}'),'{role}','"member"') where id=current_setting('jobpilot.test.target')::uuid;
set local role service_role;
do $$ declare actor uuid:=current_setting('jobpilot.test.actor')::uuid; target uuid:=current_setting('jobpilot.test.target')::uuid;
begin
 begin perform public.set_admin_role(actor,actor,'admin','member','Self removal blocked');raise exception 'Self removal allowed';exception when raise_exception then if sqlerrm<>'self_role_change' then raise;end if;end;
 if not public.set_admin_role(actor,target,'member','admin','Approved operational backup admin') then raise exception 'Promotion failed';end if;
 if not exists(select 1 from public.admin_operation_events where actor_id=actor and user_id=target and status='role_changed:admin' and reason='Approved operational backup admin') then raise exception 'Role change unaudited';end if;
 begin perform public.set_admin_role(actor,target,'member','admin','Stale change rejected');raise exception 'Stale role change allowed';exception when raise_exception then if sqlerrm<>'role_conflict' then raise;end if;end;
 if not public.set_admin_role(actor,target,'admin','member','Remove backup admin permission') then raise exception 'Removal failed';end if;
 begin perform public.set_admin_role(target,actor,'admin','member','Demoted actor must fail');raise exception 'Demoted admin retained access';exception when raise_exception then if sqlerrm<>'admin_required' then raise;end if;end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('jobpilot.test.target'),'role','authenticated','app_metadata',json_build_object('role','admin'))::text,true);
do $$ begin
 if jobpilot_private.is_current_admin() then raise exception 'Stale admin JWT authorized';end if;
 begin perform public.set_admin_role(auth.uid(),current_setting('jobpilot.test.actor')::uuid,'admin','member','Browser role mutation forbidden');raise exception 'Browser role change allowed';exception when insufficient_privilege then null;end;
 begin perform jobpilot_private.recruiter_identity(current_setting('jobpilot.test.actor')::uuid);raise exception 'Schema grant exposed identity lookup';exception when insufficient_privilege then null;end;
 if exists(select 1 from pg_catalog.pg_policies where schemaname='public' and (qual like '%jwt()%app_metadata%' or with_check like '%jwt()%app_metadata%')) then raise exception 'Stale JWT policy remains';end if;
end $$;
select pass('Role controls are server-only, audited, serialized, protect self/remaining admin and reject stale JWT permissions');
select * from finish();
rollback;
