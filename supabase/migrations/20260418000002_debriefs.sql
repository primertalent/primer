create table debriefs (
  id           uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references recruiters(id) on delete cascade,
  pipeline_id  uuid not null references pipeline(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  role_id      uuid not null references roles(id) on delete cascade,
  outcome      text not null check (outcome in ('advance', 'reject', 'hold', 'neutral')),
  feedback_raw text,
  objections   jsonb,
  strengths    jsonb,
  next_action  text,
  captured_at  timestamptz not null default now()
);

create index on debriefs (candidate_id, captured_at desc);
create index on debriefs (role_id);

alter table debriefs enable row level security;

create policy "debriefs: own data"
  on debriefs for all using (recruiter_id = current_recruiter_id());
