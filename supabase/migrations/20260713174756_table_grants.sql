-- Explicit table privileges for the API roles (KAR-42).
--
-- Newer Supabase Postgres images no longer grant implicit DML on tables
-- created by migrations: the default ACL for postgres-created tables in
-- `public` gives anon/authenticated/service_role only TRUNCATE, REFERENCES
-- and TRIGGER. Without explicit grants every PostgREST request fails with
-- 42501 before RLS is even evaluated — RLS policies alone are not enough.
--
-- Grants follow least privilege; RLS remains the authorization layer on top:
--   * anon           — nothing. Every policy is `to authenticated`; the app
--                      has no anonymous data access.
--   * authenticated  — DML per table, minus what the model forbids outright:
--                      no DELETE on circle_memberships (memberships are
--                      revoked, never deleted) and only SELECT/INSERT on
--                      audit_log (append-only; 20260708170000 already revokes
--                      UPDATE/DELETE — this never grants them back).
--   * service_role   — full access for admin tooling and tests; it is never
--                      shipped to the frontend.
--
-- Future migrations that create tables must add their own grants; the pgTAP
-- structural suite asserts these privileges so a missing grant fails CI.

-- Health tables: full DML for authenticated, gated by RLS.
grant select, insert, update, delete on
  public.profiles,
  public.documents,
  public.medicines,
  public.vitals,
  public.allergies,
  public.conditions,
  public.doctors
to authenticated;

-- Memberships: no DELETE even at the privilege level.
grant select, insert, update on public.circle_memberships to authenticated;

-- Audit log: append-only.
grant select, insert on public.audit_log to authenticated;

-- audit_log.id is an identity column; INSERT needs the sequence.
grant usage, select on all sequences in schema public to authenticated;

grant select, insert, update, delete, truncate on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
