-- Complete ingestion logging: one row per inbound (success, discard, failure).
-- ingestion_log previously recorded discards only; these columns let the success
-- and failure paths leave a row too, so "no log entry" can only ever mean "never
-- arrived" — not "classified wrongly" or "silently errored".
--
-- Additive only. No data change, no RLS change. recruiter_id stays nullable
-- (missing-sender / no-recruiter-match rows carry null; service-role writes
-- bypass RLS). No FK on matched_entity_id / interaction_id — the log holds loose
-- polymorphic refs and must never cascade-couple to the tables it observes.

alter table ingestion_log
  add column outcome_path        text,     -- canonical branch label (queryable)
  add column matched_entity_type text,     -- 'candidate' | 'pipeline' | null
  add column matched_entity_id    uuid,    -- id of the matched/created entity
  add column action_type          text,    -- action row written, if any
  add column interaction_id       uuid,    -- interaction written, if any
  add column candidate_created    boolean not null default false,
  add column error                text,    -- populated when a step threw
  add column detail               jsonb;   -- proposal_raised, match confidence, dedup, pipeline_id, attachments
