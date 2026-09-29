insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 5 * 1024 * 1024, array['application/pdf']::text[])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists resume_objects_insert_guard on storage.objects;
create policy resume_objects_insert_guard
on storage.objects as restrictive for insert to anon, authenticated
with check (
  bucket_id <> 'resumes'
  or (
    (select auth.uid()) is not null
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
);

drop policy if exists resume_objects_select_guard on storage.objects;
create policy resume_objects_select_guard
on storage.objects as restrictive for select to anon, authenticated
using (bucket_id <> 'resumes');

drop policy if exists resume_objects_update_guard on storage.objects;
create policy resume_objects_update_guard
on storage.objects as restrictive for update to anon, authenticated
using (bucket_id <> 'resumes')
with check (bucket_id <> 'resumes');

drop policy if exists resume_objects_delete_guard on storage.objects;
create policy resume_objects_delete_guard
on storage.objects as restrictive for delete to anon, authenticated
using (
  bucket_id <> 'resumes'
  or (
    (select auth.uid()) is not null
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
);

drop policy if exists resume_objects_insert_own on storage.objects;
create policy resume_objects_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists resume_objects_delete_own on storage.objects;
create policy resume_objects_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
