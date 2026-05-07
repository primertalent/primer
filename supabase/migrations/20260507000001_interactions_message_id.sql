-- Add message_id column to interactions for webhook retry idempotency.
-- CloudMailin (and other inbound services) retry on timeout. Storing the
-- email Message-ID header and enforcing uniqueness per recruiter prevents
-- duplicate interaction + action card rows on retry.
--
-- Partial unique index (WHERE message_id IS NOT NULL) allows multiple rows
-- with null message_id — covers manual interactions, debriefs, and any
-- interaction written before this migration.

ALTER TABLE interactions ADD COLUMN IF NOT EXISTS message_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS interactions_recruiter_message_id_idx
  ON interactions (recruiter_id, message_id)
  WHERE message_id IS NOT NULL;
