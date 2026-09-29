-- Storage remove() resolves matching object rows before deleting them. Permit
-- that lookup only for an authenticated user's own path during delete_many;
-- normal object listing and reads remain denied.
drop policy if exists resume_objects_select_guard on storage.objects;
create policy resume_objects_select_guard
on storage.objects as restrictive for select to anon, authenticated
using (
  bucket_id <> 'resumes'
  or (
    (select auth.uid()) is not null
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and storage.allow_only_operation('object.delete_many')
  )
);

drop policy if exists resume_objects_select_for_delete_own on storage.objects;
create policy resume_objects_select_for_delete_own
on storage.objects for select to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and storage.allow_only_operation('object.delete_many')
);
