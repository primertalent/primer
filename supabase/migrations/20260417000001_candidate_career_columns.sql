-- Document columns added via Supabase dashboard; bring source of truth in sync.
-- Using `add column if not exists` so this is a no-op against production.

alter table candidates
  add column if not exists career_timeline jsonb,
  add column if not exists career_signals  jsonb;
