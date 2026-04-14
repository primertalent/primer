-- Persist full AI screener and scorecard results on pipeline entries.
-- Previously only fit_score + fit_score_rationale were saved; the rich
-- analysis object was dropped on page refresh.

alter table pipeline
  add column if not exists screener_result  jsonb,
  add column if not exists scorecard_result jsonb;
