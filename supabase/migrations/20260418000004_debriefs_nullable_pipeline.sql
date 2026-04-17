alter table debriefs
  alter column pipeline_id drop not null,
  alter column role_id     drop not null;
