alter table pipeline
  add column if not exists submitted_at     timestamptz,
  add column if not exists last_followup_at timestamptz;

create index on pipeline (submitted_at) where submitted_at is not null;
