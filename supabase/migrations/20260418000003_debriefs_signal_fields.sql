alter table debriefs
  add column summary                text,
  add column motivation_signals     jsonb,
  add column competitive_signals    jsonb,
  add column risk_flags             jsonb,
  add column positive_signals       jsonb,
  add column hiring_manager_signals jsonb,
  add column questions_to_ask_next  jsonb,
  add column updates_to_record      jsonb,
  add column interaction_id         uuid references interactions(id) on delete set null;

create index on debriefs (interaction_id);
