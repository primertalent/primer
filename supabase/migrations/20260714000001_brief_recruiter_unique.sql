-- Recruiter-scoped brief idempotency backstop.
-- One morning_brief per recruiter per brief_date, across ALL conversations.
--
-- Supersedes the queued (conversation_id, brief_date) index (wrong grain): the cron
-- and the app composed into DIFFERENT conversations on the same day, so a
-- conversation-scoped unique index would not have fired. See FRICTION.md (6/11, 6/12
-- morning_brief entries) and the 2026-07-14 divergence diagnosis.
--
-- Partial + expression index on the JSONB brief_date. Only morning_brief rows are
-- constrained; all other conversation_messages are unaffected.
--
-- NOTE: if the divergence bug already produced duplicate briefs, this CREATE will
-- fail on the existing dupes. De-duplicate first (keep the earliest per
-- recruiter_id + brief_date, delete the rest) before applying — see the deploy note.

create unique index if not exists conversation_messages_recruiter_brief_date_idx
  on conversation_messages (recruiter_id, (content->>'brief_date'))
  where content->>'type' = 'morning_brief';
