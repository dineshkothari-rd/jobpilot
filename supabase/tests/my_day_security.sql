begin;
select plan(1);
select set_config('jobpilot.test.owner', (select id::text from auth.users u where not exists (select 1 from public.my_day_preferences p where p.user_id = u.id) order by created_at limit 1), true);
do $$ begin
  if nullif(current_setting('jobpilot.test.owner', true), '') is null then raise exception 'One existing account without a daily plan is required'; end if;
  if has_table_privilege('anon', 'public.my_day_preferences', 'SELECT') or has_table_privilege('authenticated', 'public.my_day_preferences', 'TRUNCATE') then raise exception 'Unexpected client privileges'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('jobpilot.test.owner'), 'role', 'authenticated')::text, true);
insert into public.my_day_preferences (user_id, preferences) values (current_setting('jobpilot.test.owner')::uuid, '{}');
do $$ begin
  if (select count(*) from public.my_day_preferences) <> 1 then raise exception 'Owner read failed'; end if;
  begin delete from public.my_day_preferences; raise exception 'Client delete was allowed'; exception when insufficient_privilege then null; end;
  begin update public.my_day_preferences set preferences = '[]'; raise exception 'Invalid plan shape was allowed'; exception when check_violation then null; end;
  update public.my_day_preferences set version = version + 1 where user_id = current_setting('jobpilot.test.owner')::uuid;
  if not found then raise exception 'Owner update failed'; end if;
  begin
    update public.my_day_preferences set user_id = '00000000-0000-4000-8000-000000000001' where user_id = current_setting('jobpilot.test.owner')::uuid;
    raise exception 'Owner reassignment was allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$ begin
  if exists (select 1 from public.my_day_preferences) then raise exception 'Other-account read was allowed'; end if;
  update public.my_day_preferences set version = version + 1 where user_id = current_setting('jobpilot.test.owner')::uuid;
  if found then raise exception 'Other-account update was allowed'; end if;
  begin
    insert into public.my_day_preferences(user_id) values(current_setting('jobpilot.test.owner')::uuid);
    raise exception 'Other-account insert was allowed';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin perform 1 from public.my_day_preferences; raise exception 'Anonymous read was allowed'; exception when insufficient_privilege then null; end;
  begin insert into public.my_day_preferences(user_id) values(current_setting('jobpilot.test.owner')::uuid); raise exception 'Anonymous insert was allowed'; exception when insufficient_privilege then null; end;
  begin update public.my_day_preferences set version = version + 1; raise exception 'Anonymous update was allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select pass('my day security assertions completed');
select * from finish();
rollback;
