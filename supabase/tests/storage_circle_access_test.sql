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

select plan(11);

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

-- Path helper: resolves a profile, and fails closed otherwise ----------------

select is(
  public.document_path_owner('not-a-uuid/report.pdf'),
  null, 'a non-uuid path prefix resolves to null rather than raising');

select is(
  public.document_path_owner('11111111-1111-4111-8111-111111111111/report.pdf'),
  null, 'a well-formed prefix that is nobody resolves to null, not to itself');

-- A real account, so the signup trigger gives us a real profile to resolve to.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values (
  '00000000-0000-0000-0000-000000000000',
  '77777777-7777-4777-8777-777777777777', 'authenticated', 'authenticated',
  'storage-path@test.local', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', ''
);

select is(
  public.document_path_owner(
    (select p.id from public.profiles p
     where p.user_id = '77777777-7777-4777-8777-777777777777')::text || '/report.pdf'),
  (select p.id from public.profiles p
   where p.user_id = '77777777-7777-4777-8777-777777777777'),
  'a path under a profile id resolves to that profile');

-- Files uploaded before KAR-48 sit under the uploader's *account* id. They
-- still have to resolve, or every existing document would become unreachable.
select is(
  public.document_path_owner('77777777-7777-4777-8777-777777777777/legacy.pdf'),
  (select p.id from public.profiles p
   where p.user_id = '77777777-7777-4777-8777-777777777777'),
  'a legacy path under an account id resolves to that account profile');

select * from finish();
rollback;
