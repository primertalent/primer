-- Standalone screener results table.
-- Screener runs are persisted here regardless of whether the candidate
-- has a pipeline entry for the role. Allows pre-pipeline evaluation:
-- recruiter screens first, decides to add later.
-- If a pipeline entry exists, pipeline.screener_result is also backfilled
-- for denormalized access on the kanban board.

create table screener_results (
  id           uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references recruiters(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  role_id      uuid not null references roles(id) on delete cascade,
  result       jsonb not null,
  scored_at    timestamptz not null default now()
);

create index on screener_results (candidate_id, scored_at desc);
create index on screener_results (role_id);

alter table screener_results enable row level security;

create policy "screener_results: own data"
  on screener_results for all
  using (recruiter_id = (
    select id from recruiters where auth_user_id = auth.uid() limit 1
  ));
