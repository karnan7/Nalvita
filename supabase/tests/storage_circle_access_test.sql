-- pgTAP structural guards for circle access to stored files (KAR-41).
--
-- The object policies now mirror the documents-table policies, which makes two
-- things worth pinning: that no policy widened beyond the bucket or beyond
-- `authenticated`, and that the path→owner helper fails closed on a path whose
-- prefix is not a uuid (a bare cast would raise mid-policy instead).
--
-- Everything runs inside one transaction and rolls back.

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

-- The bucket itself is untouched by KAR-41 -----------------------------------

select is(
  (select public from storage.buckets where id = 'health-documents'),
  false, 'health-documents bucket is still private');

-- Policy shape ---------------------------------------------------------------

select is(
  (select count(*)::int from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname like '%health documents'),
  4, 'exactly four health-documents object policies exist (one per verb)');

select ok(
  (select bool_and(roles = '{authenticated}') from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname like '%health documents'),
  'every health-documents policy is scoped to authenticated only');

select ok(
  (select bool_and(coalesce(qual, with_check) like '%health-documents%')
   from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname like '%health documents'),
  'every health-documents policy is confined to its own bucket');

-- Role ladder mirrors the documents table: viewer reads, caregiver writes,
-- manager deletes. A select policy granting 'caregiver' would be too strict and
-- one granting anything to 'viewer' on delete far too loose.
select ok(
  (select qual like '%viewer%' from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and cmd = 'SELECT'
     and policyname like '%health documents'),
  'reading a shared file needs only viewer');

select ok(
  (select with_check like '%caregiver%' from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and cmd = 'INSERT'
     and policyname like '%health documents'),
  'uploading on someone else behalf needs caregiver');

select ok(
  (select qual like '%manager%' from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and cmd = 'DELETE'
     and policyname like '%health documents'),
  'deleting someone else file needs manager');

-- Path helper fails closed ---------------------------------------------------

select is(
  public.document_path_owner('not-a-uuid/report.pdf'),
  null, 'a non-uuid path prefix resolves to null rather than raising');

select is(
  public.document_path_owner('11111111-1111-4111-8111-111111111111/report.pdf'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'a well-formed path resolves to its owner');

select * from finish();
rollback;
