-- Recruiter vs AI confidence scores per pipeline entry.
-- Two moments: pre-call (when logging a call/meeting) and post-call (when debrief is saved).
-- Both recruiter and Wren scores captured separately and displayed together.
ALTER TABLE pipeline
  ADD COLUMN IF NOT EXISTS recruiter_confidence_pre  integer CHECK (recruiter_confidence_pre  BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS recruiter_confidence_post integer CHECK (recruiter_confidence_post BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS ai_confidence_pre         integer CHECK (ai_confidence_pre         BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS ai_confidence_post        integer CHECK (ai_confidence_post        BETWEEN 1 AND 10);
