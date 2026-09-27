begin;
select plan(1);
select set_config('jobpilot.test.owner', (select id::text from auth.users order by created_at limit 1), true);
do $$ begin
  if nullif(current_setting('jobpilot.test.owner', true), '') is null then raise exception 'An existing account is required'; end if;
  if has_table_privilege('anon','public.jobs','SELECT') or has_table_privilege('authenticated','public.jobs','DELETE') or has_table_privilege('authenticated','public.jobs','TRUNCATE') then raise exception 'Unexpected jobs privilege'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('jobpilot.test.owner'),'role','authenticated')::text,true);
insert into public.jobs(id,external_id,title,company_name,application_url,source_url,source,created_by,raw_data)
values('00000000-0000-4000-8000-000000000097','security-user-job','Security role','Example','https://jobs.example.com/security','https://jobs.example.com/security','user',current_setting('jobpilot.test.owner')::uuid,'{}');
do $$ begin
  if not exists(select 1 from public.jobs where id='00000000-0000-4000-8000-000000000097') then raise exception 'Owner read failed'; end if;
  update public.jobs set expires_at=now(),version=2 where id='00000000-0000-4000-8000-000000000097'; if not found then raise exception 'Owner update failed'; end if;
  begin update public.jobs set created_by='00000000-0000-4000-8000-000000000001' where id='00000000-0000-4000-8000-000000000097'; raise exception 'Reassignment allowed'; exception when insufficient_privilege then null; end;
  begin insert into public.jobs(external_id,title,source,raw_data) values('fake-feed-job','Fake feed','himalayas','{}'); raise exception 'Client feed insert allowed'; exception when insufficient_privilege then null; end;
  update public.jobs set title='Tampered feed' where created_by is null; if found then raise exception 'Client feed update allowed'; end if;
  begin delete from public.jobs where id='00000000-0000-4000-8000-000000000097'; raise exception 'Client delete allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
  if exists(select 1 from public.jobs where id='00000000-0000-4000-8000-000000000097') then raise exception 'Foreign read allowed'; end if;
  update public.jobs set title='Foreign update' where id='00000000-0000-4000-8000-000000000097'; if found then raise exception 'Foreign update allowed'; end if;
end $$;
set local role anon;
do $$ begin
  begin perform 1 from public.jobs; raise exception 'Anonymous read allowed'; exception when insufficient_privilege then null; end;
  begin insert into public.jobs(external_id,title) values('anon-job','Anon'); raise exception 'Anonymous insert allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select pass('user added opportunities security assertions completed');
select * from finish();
rollback;
