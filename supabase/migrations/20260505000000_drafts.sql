create table drafts (
  id                uuid primary key default gen_random_uuid(),
  recruiter_id      uuid not null references recruiters(id) on delete cascade,
  linked_entity_id  uuid,
  linked_entity_type text,
  artifact_type     text not null,
  content           jsonb not null,
  status            text not null default 'generated'
    check (status in ('generated', 'in_review', 'approved', 'sent', 'discarded')),
  confidence        text
    check (confidence is null or confidence in ('high', 'medium', 'low')),
  stakes            text
    check (stakes is null or stakes in ('low', 'medium', 'high')),
  autonomy_tier     int not null default 2
    check (autonomy_tier in (1, 2, 3)),
  source_run_id     uuid,
  source_action_id  uuid references actions(id) on delete set null,
  approved_at       timestamptz,
  sent_at           timestamptz,
  discarded_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index drafts_recruiter_idx on drafts (recruiter_id, created_at desc);
create index drafts_status_idx on drafts (recruiter_id, status)
  where status in ('generated', 'in_review');
create index drafts_linked_entity_idx on drafts (linked_entity_id, linked_entity_type);

alter table drafts enable row level security;

create policy "drafts: own data"
  on drafts for all
  using (recruiter_id = current_recruiter_id())
  with check (recruiter_id = current_recruiter_id());

create trigger trg_drafts_updated_at
  before update on drafts
  for each row execute function set_updated_at();
