-- Rename pipeline table to pipelines for Supabase naming consistency.
-- PostgreSQL automatically updates all FK constraints and indexes on rename.
-- All Supabase client .from('pipeline') calls updated in the same commit.

ALTER TABLE pipeline RENAME TO pipelines;
