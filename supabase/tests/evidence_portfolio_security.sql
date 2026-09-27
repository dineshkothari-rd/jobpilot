begin;
select plan(1);
select set_config('jobpilot.test.owner', (select id::text from auth.users order by created_at limit 1), true);
do $$ begin
  if nullif(current_setting('jobpilot.test.owner', true), '') is null then raise exception 'An existing account is required'; end if;
  if has_table_privilege('anon','public.portfolio_evidence','SELECT') or has_table_privilege('authenticated','public.portfolio_evidence','TRUNCATE') then raise exception 'Unexpected portfolio privilege'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('jobpilot.test.owner'),'role','authenticated')::text,true);
insert into public.portfolio_evidence(id,user_id,title,contribution)
values('00000000-0000-4000-8000-000000000096',current_setting('jobpilot.test.owner')::uuid,'Security evidence','I created and verified this synthetic security record.');
do $$ begin
  if not exists(select 1 from public.portfolio_evidence where id='00000000-0000-4000-8000-000000000096') then raise exception 'Owner read failed'; end if;
  update public.portfolio_evidence set reviewed_at=now(),version=2 where id='00000000-0000-4000-8000-000000000096'; if not found then raise exception 'Owner update failed'; end if;
  begin update public.portfolio_evidence set user_id='00000000-0000-4000-8000-000000000001' where id='00000000-0000-4000-8000-000000000096'; raise exception 'Reassignment allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
  if exists(select 1 from public.portfolio_evidence where id='00000000-0000-4000-8000-000000000096') then raise exception 'Foreign read allowed'; end if;
  update public.portfolio_evidence set title='Foreign update' where id='00000000-0000-4000-8000-000000000096'; if found then raise exception 'Foreign update allowed'; end if;
  delete from public.portfolio_evidence where id='00000000-0000-4000-8000-000000000096'; if found then raise exception 'Foreign delete allowed'; end if;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('jobpilot.test.owner'),'role','authenticated')::text,true);
delete from public.portfolio_evidence where id='00000000-0000-4000-8000-000000000096';
do $$ begin if exists(select 1 from public.portfolio_evidence where id='00000000-0000-4000-8000-000000000096') then raise exception 'Owner delete failed'; end if; end $$;
set local role anon;
do $$ begin
  begin perform 1 from public.portfolio_evidence; raise exception 'Anonymous read allowed'; exception when insufficient_privilege then null; end;
  begin insert into public.portfolio_evidence(user_id,title,contribution) values(current_setting('jobpilot.test.owner')::uuid,'Anon','Anonymous insertion should never be allowed.'); raise exception 'Anonymous insert allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select pass('evidence portfolio security assertions completed');
select * from finish();
rollback;
