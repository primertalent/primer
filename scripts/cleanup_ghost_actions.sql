-- cleanup_ghost_actions.sql
-- One-time cleanup for ghost action cards from old builds.
--
-- This file contains a destructive DELETE that is intentionally commented out.
-- Run Query 1 and Query 2 first, review results, then uncomment the DELETE block.
--
-- ── Active action_type set (what gets written to actions.action_type) ─────────
-- Agent loop (agentLoop.js):
--   follow_up_overdue, risk_flag, missing_data, opportunity,
--   stage_check, relationship_warm, mcp_opportunity, sharpening_ask
-- Ingest path (ingest-email.js):
--   new_inbound, notes_pending_match, intake_notes_ready, submittal_draft_ready
--
-- NOTE: agentResponse.js chip IDs (screen_against_role, draft_submission,
-- add_fee, log_debrief, etc.) are embedded in context JSON as suggestion
-- actions, not stored in the action_type column. They are not rows.
--
-- ── Stale criteria ────────────────────────────────────────────────────────────
-- Criterion A: action_type not in the active set above (old build prompt artifacts)
-- Criterion B: action_type IS valid but row is open and predates 2026-05-14
--              (DB was cleared 2026-05-13; any open pre-cutoff row is stale context)
--
-- ── Before you run the DELETE ─────────────────────────────────────────────────
-- Check Query 1 results:
--   Criterion A rows: safe to delete unconditionally (unknown types = old build artifacts).
--   Criterion B count: if more than ~20 rows, run Query 2 and inspect why_preview text.
--   If 50+ Criterion B rows appear, the cutoff assumption may be wrong — diagnose
--   before deleting (something other than old build ghosts may have created them).
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Query 1: Count by criterion ───────────────────────────────────────────────
-- Run this first. Shows how many rows match each criterion and which action_types.

SELECT
  CASE
    WHEN action_type NOT IN (
      'follow_up_overdue','risk_flag','missing_data','opportunity',
      'stage_check','relationship_warm','mcp_opportunity','sharpening_ask',
      'new_inbound','notes_pending_match','intake_notes_ready','submittal_draft_ready'
    ) THEN 'A: unknown_action_type'
    ELSE 'B: valid_type_pre_cutoff'
  END                   AS criterion,
  action_type,
  COUNT(*)              AS open_count,
  MIN(created_at)::date AS oldest,
  MAX(created_at)::date AS newest
FROM actions
WHERE
  acted_on_at  IS NULL
  AND dismissed_at IS NULL
  AND (
    action_type NOT IN (
      'follow_up_overdue','risk_flag','missing_data','opportunity',
      'stage_check','relationship_warm','mcp_opportunity','sharpening_ask',
      'new_inbound','notes_pending_match','intake_notes_ready','submittal_draft_ready'
    )
    OR created_at < '2026-05-14T00:00:00Z'
  )
GROUP BY criterion, action_type
ORDER BY criterion, open_count DESC;


-- ── Query 2: Sample 5 rows from each criterion ────────────────────────────────
-- Spot-check the why text. Criterion B rows should show old test-candidate content
-- or empty context. If they show real active deal names, narrow the cutoff before
-- running the DELETE.

(
  SELECT
    'A: unknown_action_type'   AS criterion,
    id, action_type, created_at,
    LEFT(why, 100)             AS why_preview,
    urgency
  FROM actions
  WHERE
    acted_on_at IS NULL AND dismissed_at IS NULL
    AND action_type NOT IN (
      'follow_up_overdue','risk_flag','missing_data','opportunity',
      'stage_check','relationship_warm','mcp_opportunity','sharpening_ask',
      'new_inbound','notes_pending_match','intake_notes_ready','submittal_draft_ready'
    )
  ORDER BY created_at DESC
  LIMIT 5
)
UNION ALL
(
  SELECT
    'B: valid_type_pre_cutoff' AS criterion,
    id, action_type, created_at,
    LEFT(why, 100)             AS why_preview,
    urgency
  FROM actions
  WHERE
    acted_on_at IS NULL AND dismissed_at IS NULL
    AND action_type IN (
      'follow_up_overdue','risk_flag','missing_data','opportunity',
      'stage_check','relationship_warm','mcp_opportunity','sharpening_ask',
      'new_inbound','notes_pending_match','intake_notes_ready','submittal_draft_ready'
    )
    AND created_at < '2026-05-14T00:00:00Z'
  ORDER BY created_at DESC
  LIMIT 5
)
ORDER BY criterion, created_at DESC;


-- ── DELETE (COMMENTED OUT — uncomment only after reviewing both queries above) ─
/*
DELETE FROM actions
WHERE
  acted_on_at  IS NULL
  AND dismissed_at IS NULL
  AND (
    action_type NOT IN (
      'follow_up_overdue','risk_flag','missing_data','opportunity',
      'stage_check','relationship_warm','mcp_opportunity','sharpening_ask',
      'new_inbound','notes_pending_match','intake_notes_ready','submittal_draft_ready'
    )
    OR created_at < '2026-05-14T00:00:00Z'
  );
*/
