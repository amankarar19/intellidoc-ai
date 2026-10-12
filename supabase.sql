-- =====================================================================
-- IntelliDoc Lite - Supabase / PostgreSQL schema
-- Run this whole script once in: Supabase Dashboard -> SQL Editor -> New query
-- It is safe to run again (it uses IF NOT EXISTS / DROP POLICY IF EXISTS).
-- =====================================================================

-- 1. Table ------------------------------------------------------------
create table if not exists public.documents (
  id              uuid        primary key default gen_random_uuid(),
  title           text        not null,
  document_type   text        not null,
  document_number text        not null,
  expiry_date     date,                                   -- optional
  status          text        not null default 'Pending',
  notes           text,                                   -- optional
  created_at      timestamptz not null default now(),

  -- Constraints (the database enforces the rules even if the UI is bypassed)
  constraint documents_status_check
    check (status in ('Pending', 'Verified', 'Rejected')),
  constraint documents_title_not_blank
    check (length(btrim(title)) > 0),
  constraint documents_type_not_blank
    check (length(btrim(document_type)) > 0),
  constraint documents_number_not_blank
    check (length(btrim(document_number)) > 0)
);

-- 2. Indexes (speed up filtering and the "newest first" listing) --------
create index if not exists documents_status_idx     on public.documents (status);
create index if not exists documents_created_at_idx on public.documents (created_at desc);
create index if not exists documents_expiry_idx     on public.documents (expiry_date);

-- 3. Row Level Security ------------------------------------------------
-- RLS is ON, so nobody can touch the table unless a policy allows it.
alter table public.documents enable row level security;

-- 4. DEVELOPMENT / CLASSROOM-DEMO ACCESS POLICIES ------------------------
-- WARNING: These policies let ANYONE who has your project URL and anon key
-- read, add, edit and delete every row (the app has no login in this MVP).
-- That is acceptable ONLY for a disposable demo project containing FAKE data.
-- Do NOT store real personal, identity or financial documents here.
grant select, insert, update, delete on public.documents to anon, authenticated;

drop policy if exists "demo_select" on public.documents;
drop policy if exists "demo_insert" on public.documents;
drop policy if exists "demo_update" on public.documents;
drop policy if exists "demo_delete" on public.documents;

create policy "demo_select" on public.documents
  for select to anon, authenticated using (true);

create policy "demo_insert" on public.documents
  for insert to anon, authenticated with check (true);

create policy "demo_update" on public.documents
  for update to anon, authenticated using (true) with check (true);

create policy "demo_delete" on public.documents
  for delete to anon, authenticated using (true);

-- 5. BEFORE REAL DEPLOYMENT: replace the demo policies --------------------
-- Step A: add Supabase Auth to the app (email/password or magic link).
-- Step B: add an owner column:
--     alter table public.documents
--       add column user_id uuid not null default auth.uid()
--       references auth.users (id) on delete cascade;
-- Step C: remove the demo policies and revoke anonymous access:
--     drop policy "demo_select" on public.documents;
--     drop policy "demo_insert" on public.documents;
--     drop policy "demo_update" on public.documents;
--     drop policy "demo_delete" on public.documents;
--     revoke all on public.documents from anon;
-- Step D: create restrictive per-user policies:
--     create policy "own_select" on public.documents
--       for select to authenticated using ((select auth.uid()) = user_id);
--     create policy "own_insert" on public.documents
--       for insert to authenticated with check ((select auth.uid()) = user_id);
--     create policy "own_update" on public.documents
--       for update to authenticated
--       using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
--     create policy "own_delete" on public.documents
--       for delete to authenticated using ((select auth.uid()) = user_id);

-- 5b. IntelliDoc AI columns (additive; same as supabase-ai-migration.sql) -----
alter table public.documents
  add column if not exists source_filename  text,
  add column if not exists ai_summary       text,
  add column if not exists extracted_fields jsonb,
  add column if not exists review_findings  jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'documents_ai_summary_len') then
    alter table public.documents add constraint documents_ai_summary_len check (ai_summary is null or length(ai_summary) <= 5000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'documents_source_filename_len') then
    alter table public.documents add constraint documents_source_filename_len check (source_filename is null or length(source_filename) <= 200);
  end if;
end $$;

-- 5c. LOGIN: after this script, run supabase-auth-migration.sql (adds user_id and per-user policies,
--     removes the open demo policies above, and deletes existing rows).

-- 6. OPTIONAL fictional sample rows (uncomment to use) -------------------
-- insert into public.documents (title, document_type, document_number, expiry_date, status, notes) values
--   ('Sample Training Certificate', 'Certificate', 'CERT-DEMO-1001', '2099-12-31', 'Verified', 'Fictional sample record.'),
--   ('Sample Vendor Invoice',       'Invoice',     'INV-DEMO-2002',  null,         'Pending',  'Fictional sample record. Awaiting review.'),
--   ('Sample Site Permit',          'Permit',      'PRM-DEMO-3003', '2024-01-31', 'Rejected', 'Fictional sample record. Expired.');
