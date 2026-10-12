-- =====================================================================
-- IntelliDoc AI - additive migration (safe to run more than once)
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
--
-- It only ADDS four nullable columns to public.documents.
-- It does not delete, rename or change any existing column or row.
-- (supabase.sql already contains the same statements for fresh installs.)
-- =====================================================================

alter table public.documents
  add column if not exists source_filename  text,   -- name of the uploaded PDF (the PDF itself is NOT stored)
  add column if not exists ai_summary       text,   -- Gemini's short summary (suggestion, not evidence)
  add column if not exists extracted_fields jsonb,  -- holder_name, issue_date, important_dates, uncertain_fields, ...
  add column if not exists review_findings  jsonb;  -- missing info, inconsistencies, attention points, recommendations

-- Basic size guards so a single row cannot be filled with huge text.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'documents_ai_summary_len') then
    alter table public.documents
      add constraint documents_ai_summary_len check (ai_summary is null or length(ai_summary) <= 5000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'documents_source_filename_len') then
    alter table public.documents
      add constraint documents_source_filename_len check (source_filename is null or length(source_filename) <= 200);
  end if;
end $$;

comment on column public.documents.ai_summary       is 'AI-generated summary. A suggestion for human review, not verified information.';
comment on column public.documents.extracted_fields is 'AI-extracted fields after human review/editing in the app.';
comment on column public.documents.review_findings  is 'AI review notes (observation / suggestion / check). Not proof of authenticity.';
