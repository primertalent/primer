-- Phase 2.5 Build 2 — ingestion_log for discarded email audit trail
-- Also makes interactions.candidate_id nullable to support client_communication
-- interactions that have no candidate context.

create table ingestion_log (
  id             uuid primary key default gen_random_uuid(),
  recruiter_id   uuid references recruiters(id) on delete cascade,
  from_email     text,
  subject        text,
  classification text,
  reason         text,
  raw_payload    jsonb,
  created_at     timestamptz not null default now()
);

create index ingestion_log_recruiter_idx
  on ingestion_log (recruiter_id, created_at desc);

alter table ingestion_log enable row level security;

create policy "ingestion_log: own data"
  on ingestion_log for all
  using (recruiter_id = current_recruiter_id())
  with check (recruiter_id = current_recruiter_id());

-- Allow client_communication interactions to be written without a candidate
alter table interactions
  alter column candidate_id drop not null;
