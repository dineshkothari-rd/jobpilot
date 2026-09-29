begin;
select plan(1);

select set_config('jobpilot.test.owner', (select id::text from auth.users order by created_at limit 1), true);
select set_config('jobpilot.test.other', (select id::text from auth.users order by created_at offset 1 limit 1), true);

do $$
begin
  if nullif(current_setting('jobpilot.test.owner', true), '') is null
    or nullif(current_setting('jobpilot.test.other', true), '') is null then
    raise exception 'Two existing accounts are required';
  end if;

  if not exists (
    select 1 from storage.buckets
    where id = 'resumes'
      and name = 'resumes'
      and public = false
      and file_size_limit = 5 * 1024 * 1024
      and allowed_mime_types = array['application/pdf']::text[]
  ) then
    raise exception 'Private resume bucket constraints are missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'resume_objects_delete_own'
      and cmd = 'DELETE'
      and permissive = 'PERMISSIVE'
      and roles = array['authenticated']::name[]
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'resume_objects_delete_guard'
      and cmd = 'DELETE'
      and permissive = 'RESTRICTIVE'
  ) then
    raise exception 'Owner-only resume delete policies are missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'resume_objects_select_for_delete_own'
      and cmd = 'SELECT'
      and permissive = 'PERMISSIVE'
      and roles = array['authenticated']::name[]
      and qual like '%allow_only_operation%object.delete_many%'
  ) then
    raise exception 'Operation-scoped owner lookup for Storage deletion is missing';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('jobpilot.test.owner'), 'role', 'authenticated')::text, true);

insert into storage.objects (bucket_id, name, owner_id, metadata)
values ('resumes', current_setting('jobpilot.test.owner') || '/security-owner.pdf', current_setting('jobpilot.test.owner'), '{"mimetype":"application/pdf","size":1}');

select set_config('request.jwt.claims', json_build_object('sub', current_setting('jobpilot.test.other'), 'role', 'authenticated')::text, true);

do $$
declare affected integer;
begin
  if exists (
    select 1 from storage.objects
    where bucket_id = 'resumes'
      and name = current_setting('jobpilot.test.owner') || '/security-owner.pdf'
  ) then raise exception 'Foreign resume read allowed'; end if;

  update storage.objects set user_metadata = '{"tampered":true}'
  where bucket_id = 'resumes'
    and name = current_setting('jobpilot.test.owner') || '/security-owner.pdf';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Foreign resume update allowed'; end if;

  begin
    insert into storage.objects (bucket_id, name, owner_id)
    values ('resumes', current_setting('jobpilot.test.owner') || '/security-foreign.pdf', current_setting('jobpilot.test.other'));
    raise exception 'Cross-user resume insert allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  begin
    if exists (select 1 from storage.objects where bucket_id = 'resumes') then
      raise exception 'Anonymous resume read allowed';
    end if;
  exception when insufficient_privilege then null;
  end;

  begin
    insert into storage.objects (bucket_id, name)
    values ('resumes', 'anonymous/security.pdf');
    raise exception 'Anonymous resume insert allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select pass('resume Storage bucket and ownership assertions completed');
select * from finish();
rollback;
