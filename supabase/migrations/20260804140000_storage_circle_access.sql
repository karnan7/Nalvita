-- Storage access for Health Circle members (KAR-41).
--
-- The `documents` table policies (KAR-33) grant circle members access to a
-- shared owner's document rows, but the storage.objects policies from the
-- initial schema are strictly owner-prefix. A viewer shared on 'documents'
-- could therefore list an owner's documents and never open one — sharing that
-- stops at the metadata. This migration brings the two into agreement.
--
-- The four object policies now mirror the documents-table policies exactly:
--   select -> viewer, insert/update -> caregiver, delete -> manager
-- so a caregiver adding a record on the owner's behalf can upload its file,
-- and nothing grants storage access that the table would not already grant.
--
-- Files stay private: the bucket is unchanged (public = false, 20 MB, PDF/JPG/
-- PNG), and reads still happen only through short-lived signed URLs.
--
-- With zero circle_memberships rows, has_circle_access() is false for everyone
-- and the behavior is identical to the owner-only policies replaced here.

-- ---------------------------------------------------------------------------
-- Path → owner
--
-- Objects live at '<owner_uuid>/<filename>'. The policies need that prefix as
-- a uuid, but `name` is user-supplied: a path whose first segment is not a
-- uuid would make a bare cast raise mid-policy instead of simply not matching.
-- This returns null for anything unparseable, and has_circle_access(null, ...)
-- is false, so a malformed path fails closed.
-- ---------------------------------------------------------------------------

create or replace function public.document_path_owner(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when (storage.foldername(p_name))[1] ~*
         '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(p_name))[1])::uuid
  end;
$$;

revoke execute on function public.document_path_owner(text) from public, anon;
grant execute on function public.document_path_owner(text) to authenticated;

-- ---------------------------------------------------------------------------
-- storage.objects policies for the health-documents bucket
-- ---------------------------------------------------------------------------

drop policy "Users can view own health documents" on storage.objects;
drop policy "Users can upload own health documents" on storage.objects;
drop policy "Users can update own health documents" on storage.objects;
drop policy "Users can delete own health documents" on storage.objects;

create policy "Owner or circle can view health documents" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'health-documents'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.has_circle_access(public.document_path_owner(name), 'viewer', 'documents')
    )
  );

create policy "Owner or circle can upload health documents" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'health-documents'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.has_circle_access(public.document_path_owner(name), 'caregiver', 'documents')
    )
  );

create policy "Owner or circle can update health documents" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'health-documents'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.has_circle_access(public.document_path_owner(name), 'caregiver', 'documents')
    )
  );

create policy "Owner or circle can delete health documents" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'health-documents'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.has_circle_access(public.document_path_owner(name), 'manager', 'documents')
    )
  );
