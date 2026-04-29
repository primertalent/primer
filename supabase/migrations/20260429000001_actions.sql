-- Phase 1 Engine: actions table for the agent loop

CREATE TABLE IF NOT EXISTS actions (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id       uuid        NOT NULL REFERENCES recruiters(id),
  action_type        text        NOT NULL,
  -- active: follow_up_overdue, risk_flag, missing_data, opportunity,
  --         stage_check, relationship_warm, mcp_opportunity
  -- background: sharpening_ask
  linked_entity_id   uuid,
  linked_entity_type text,
  -- 'pipeline' | 'candidate' | 'role' | 'client' | 'recruiter'
  urgency            text        NOT NULL DEFAULT 'this_week',
  -- 'now' | 'today' | 'this_week'
  why                text,
  suggested_next_step text,
  confidence         text,
  -- 'high' | 'medium' | 'low'
  context            jsonb,
  content_hash       text,
  -- sha256(recruiter_id:linked_entity_id:action_type:suggested_next_step)
  -- used for idempotency: active undismissed duplicates are skipped on insert
  created_at         timestamptz NOT NULL DEFAULT now(),
  dismissed_at       timestamptz,
  snoozed_until      timestamptz,
  acted_on_at        timestamptz,
  source_run_id      uuid
);

ALTER TABLE actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recruiter owns actions"
  ON actions FOR ALL
  USING  (recruiter_id = current_recruiter_id())
  WITH CHECK (recruiter_id = current_recruiter_id());

CREATE INDEX actions_recruiter_id_idx ON actions (recruiter_id);
CREATE INDEX actions_hash_active_idx  ON actions (content_hash)
  WHERE dismissed_at IS NULL AND acted_on_at IS NULL;
