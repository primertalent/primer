-- Morning brief delivery tracking.
-- briefed_at stamps the moment an action was announced in a morning brief.
-- Undelivered = briefed_at IS NULL. Once stamped, the action is excluded
-- from future briefs regardless of what happens to the conversation row.

ALTER TABLE actions ADD COLUMN IF NOT EXISTS briefed_at timestamptz;

-- Partial index: the "undelivered actions" query filters on IS NULL.
CREATE INDEX IF NOT EXISTS actions_undelivered_idx
  ON actions (recruiter_id, created_at DESC)
  WHERE briefed_at IS NULL
    AND dismissed_at IS NULL
    AND acted_on_at IS NULL;
