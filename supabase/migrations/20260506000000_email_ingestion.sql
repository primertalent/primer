-- Phase 2.5 — Email ingestion
-- Adds email_intake_address to recruiters for per-recruiter inbound routing
-- Adds meta jsonb to interactions for email classification + ingest provenance

alter table recruiters
  add column email_intake_address text unique;

alter table interactions
  add column meta jsonb;

-- Speeds up "all inbound emails for a recruiter" queries
create index interactions_recruiter_email_inbound_idx
  on interactions (recruiter_id, occurred_at desc)
  where type = 'email' and direction = 'inbound';
