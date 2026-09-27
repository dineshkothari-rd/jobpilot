begin;
select plan(1);
do $$
declare owner_id uuid;
begin
  select id into owner_id from auth.users where not exists (select 1 from public.learning_goals where user_id = auth.users.id) limit 1;
  if owner_id is null then raise exception 'Need an existing test account without saved goals'; end if;
  if exists (select 1 from public.learning_catalog where id = 'catalog-security-test') then raise exception 'Test ID already exists'; end if;
  insert into public.learning_catalog (id, definition, readings, questions)
    select 'catalog-security-test', jsonb_set(definition, '{id}', '"catalog-security-test"'), readings, questions from public.learning_catalog where id = 'web-foundations';
  update public.learning_catalog set definition = jsonb_set(definition, '{title}', '"Synthetic rollback-only course"') where id = 'catalog-security-test';
  insert into public.learning_answer_keys(path_id, questions) select 'catalog-security-test', questions from public.learning_answer_keys where path_id = 'web-foundations';
  insert into public.skillpath_enrollments(user_id, path_id, selected_lesson) values (owner_id, 'catalog-security-test', 'html');
  begin
    update public.learning_catalog set readings = '{}' where id = 'catalog-security-test';
    raise exception 'Enrolled course changed';
  exception when raise_exception then
    if sqlerrm not like 'Enrolled content is immutable%' then raise; end if;
  end;
  begin
    update public.learning_answer_keys set questions = questions where path_id = 'catalog-security-test';
    raise exception 'Enrolled answer key changed';
  exception when raise_exception then
    if sqlerrm not like 'Enrolled content is immutable%' then raise; end if;
  end;
  insert into public.learning_goals(user_id, skills) values (owner_id, array['SQL']);
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
end $$;
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.learning_catalog where id = 'catalog-security-test') then raise exception 'Catalogue read denied'; end if;
  if (select count(*) from public.learning_goals where user_id = auth.uid()) <> 1 then raise exception 'Owner goals missing'; end if;
  if exists (select 1 from public.learning_goals where user_id <> auth.uid()) then raise exception 'Foreign goals exposed'; end if;
  if has_table_privilege('authenticated', 'public.learning_catalog', 'UPDATE') or has_table_privilege('authenticated', 'public.learning_goals', 'INSERT') then raise exception 'Unexpected direct write grant'; end if;
  begin
    perform 1 from public.learning_answer_keys;
    raise exception 'Answer keys exposed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set local role anon;
do $$
begin
  if has_table_privilege('anon', 'public.learning_catalog', 'SELECT') or has_table_privilege('anon', 'public.learning_goals', 'SELECT') or has_table_privilege('anon', 'public.learning_answer_keys', 'SELECT') then raise exception 'Anonymous access exposed'; end if;
end $$;
reset role;
select pass('dynamic learning security assertions completed');
select * from finish();
rollback;
