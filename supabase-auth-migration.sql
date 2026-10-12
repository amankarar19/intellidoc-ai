-- =====================================================================
-- IntelliDoc AI: login support (run AFTER supabase.sql and supabase-ai-migration.sql)
-- Each row belongs to the user who created it; users can only see and change their own rows.
-- WARNING: this DELETES existing rows (they have no owner). Fictional test data only.
-- =====================================================================

delete from public.documents;

alter table public.documents
  add column if not exists user_id uuid not null default auth.uid()
  references auth.users (id) on delete cascade;

create index if not exists documents_user_id_idx on public.documents (user_id);

-- Remove the open demo policies and anonymous access
drop policy if exists "demo_select" on public.documents;
drop policy if exists "demo_insert" on public.documents;
drop policy if exists "demo_update" on public.documents;
drop policy if exists "demo_delete" on public.documents;
revoke all on public.documents from anon;
grant select, insert, update, delete on public.documents to authenticated;

drop policy if exists "own_select" on public.documents;
drop policy if exists "own_insert" on public.documents;
drop policy if exists "own_update" on public.documents;
drop policy if exists "own_delete" on public.documents;

create policy "own_select" on public.documents
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own_insert" on public.documents
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own_update" on public.documents
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own_delete" on public.documents
  for delete to authenticated using ((select auth.uid()) = user_id);
