-- =====================================================================
-- IntelliDoc AI: require Google Authenticator (two-factor) for data access
-- Run AFTER supabase.sql, supabase-ai-migration.sql and supabase-auth-migration.sql.
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to run more than once.
--
-- A RESTRICTIVE policy is combined (AND) with the existing "own rows" policies, so a user must BOTH
-- own the row AND have signed in with the authenticator code (aal2). A token from a password-only
-- sign-in (aal1) can no longer read or change any document, even by calling the API directly.
-- =====================================================================

drop policy if exists "require_aal2" on public.documents;

create policy "require_aal2" on public.documents
  as restrictive
  for all
  to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select auth.jwt() ->> 'aal') = 'aal2');
