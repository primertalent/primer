-- ============================================================
-- PRIMER — Complete Database Schema
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

create type message_channel   as enum ('email', 'linkedin', 'text');
create type message_status    as enum ('drafted', 'approved', 'sent', 'held_for_review');
create type message_direction as enum ('inbound', 'outbound');
create type role_status       as enum ('open', 'on_hold', 'filled', 'cancelled');
create type pipeline_status   as enum ('active', 'rejected', 'placed', 'archived');
create type candidate_source  as enum ('sourced', 'inbound', 'referral', 'job_board', 'other');
create type interaction_type  as enum ('email', 'linkedin', 'text', 'call', 'note', 'meeting');
create type intel_signal_type as enum ('funding', 'executive_post', 'news', 'job_posting', 'other');
create type comp_type         as enum ('salary', 'hourly', 'contract', 'equity_plus_salary');

-- ============================================================
-- RECRUITERS
-- ============================================================

create table recruiters (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text not null,
  avatar_url  text,
  timezone    text not null default 'America/New_York',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id)
);

-- Voice training data: examples of the recruiter's own emails/messages
-- used to tune AI-drafted communication to their personal style
create table voice_samples (
  id           uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references recruiters(id) on delete cascade,
  channel      message_channel not null,
  subject      text,
  body         text not null,
  notes        text,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- CLIENTS
-- ============================================================

create table clients (
  id           uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references recruiters(id) on delete cascade,
  name         text not null,
  website      text,
  industry     text,
  hq_location  text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Key contacts at each client company
create table client_contacts (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  recruiter_id uuid not null references recruiters(id) on delete cascade,
  full_name    text not null,
  title        text,
  email        text,
  phone        text,
  linkedin_url text,
  is_primary   boolean not null default false,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Autonomous intelligence feed per client (funding, exec posts, news)
create table client_intelligence (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  recruiter_id uuid not null references recruiters(id) on delete cascade,
  signal_type  intel_signal_type not null,
  headline     text not null,
  body         text,
  source_url   text,
  detected_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- ============================================================
-- ROLES
-- ============================================================

create table roles (
  id            uuid primary key default gen_random_uuid(),
  recruiter_id  uuid not null references recruiters(id) on delete cascade,
  client_id     uuid not null references clients(id) on delete cascade,
  title         text not null,
  description   text,
  comp_min      numeric(12,2),
  comp_max      numeric(12,2),
  comp_currency text not null default 'USD',
  comp_type     comp_type,
  status        role_status not null default 'open',
  -- ordered list of stage names for this role's hiring process
  -- e.g. ["Sourced","Screen","Hiring Manager","Final Round","Offer","Placed"]
  process_steps jsonb not null default '[]',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- CANDIDATES
-- ============================================================

create table candidates (
  id              uuid primary key default gen_random_uuid(),
  recruiter_id    uuid not null references recruiters(id) on delete cascade,
  first_name      text not null,
  last_name       text not null,
  email           text,
  phone           text,
  linkedin_url    text,
  current_title   text,
  current_company text,
  location        text,
  skills          text[] not null default '{}',
  source          candidate_source not null default 'sourced',
  -- raw CV/resume text for AI processing and search
  cv_text         text,
  -- structured data returned from enrichment providers (Clay, Apollo, etc.)
  enrichment_data jsonb,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- PIPELINE  (candidate × role)
-- ============================================================

create table pipeline (
  id                  uuid primary key default gen_random_uuid(),
  recruiter_id        uuid not null references recruiters(id) on delete cascade,
  candidate_id        uuid not null references candidates(id) on delete cascade,
  role_id             uuid not null references roles(id) on delete cascade,
  current_stage       text not null,
  status              pipeline_status not null default 'active',
  -- AI-generated fit score 0–100 for this candidate against this role
  fit_score           numeric(5,2) check (fit_score between 0 and 100),
  fit_score_rationale text,
  next_action         text,
  next_action_due_at  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (candidate_id, role_id)
);

-- Full stage movement history for every pipeline entry
create table pipeline_stage_history (
  id           uuid primary key default gen_random_uuid(),
  pipeline_id  uuid not null references pipeline(id) on delete cascade,
  recruiter_id uuid not null references recruiters(id) on delete cascade,
  stage        text not null,
  entered_at   timestamptz not null default now(),
  exited_at    timestamptz,
  notes        text
);

-- ============================================================
-- INTERACTIONS  (full history log per candidate)
-- ============================================================

create table interactions (
  id           uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references recruiters(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  pipeline_id  uuid references pipeline(id) on delete set null,
  type         interaction_type not null,
  direction    message_direction,
  subject      text,
  body         text,
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- ============================================================
-- MESSAGES  (Primer-drafted communications queue)
-- ============================================================

create table messages (
  id                uuid primary key default gen_random_uuid(),
  recruiter_id      uuid not null references recruiters(id) on delete cascade,
  candidate_id      uuid references candidates(id) on delete set null,
  client_contact_id uuid references client_contacts(id) on delete set null,
  pipeline_id       uuid references pipeline(id) on delete set null,
  channel           message_channel not null,
  subject           text,
  body              text not null,
  -- 0.0–1.0: how confident the AI is this message needs no edits
  -- >= 0.85 surfaces in Approve & Send queue; below that goes to held_for_review
  confidence_score  numeric(4,3) check (confidence_score between 0 and 1),
  status            message_status not null default 'drafted',
  sent_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ============================================================
-- DAILY BRIEFS
-- ============================================================

create table daily_briefs (
  id           uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references recruiters(id) on delete cascade,
  brief_date   date not null,
  -- structured JSON: { summary, priority_actions[], pipeline_updates[], intel[], follow_ups[] }
  content      jsonb not null,
  created_at   timestamptz not null default now(),
  unique (recruiter_id, brief_date)
);

-- ============================================================
-- INDEXES
-- ============================================================

create index on voice_samples           (recruiter_id);
create index on clients                 (recruiter_id);
create index on client_contacts         (client_id);
create index on client_contacts         (recruiter_id);
create index on client_intelligence     (client_id, detected_at desc);
create index on roles                   (recruiter_id, status);
create index on roles                   (client_id);
create index on candidates              (recruiter_id);
create index on candidates              (recruiter_id, current_company);
create index on pipeline                (recruiter_id, status);
create index on pipeline                (candidate_id);
create index on pipeline                (role_id);
create index on pipeline                (next_action_due_at) where status = 'active';
create index on pipeline_stage_history  (pipeline_id, entered_at desc);
create index on interactions            (candidate_id, occurred_at desc);
create index on interactions            (recruiter_id, occurred_at desc);
create index on messages                (recruiter_id, status);
create index on messages                (recruiter_id, created_at desc);
create index on daily_briefs            (recruiter_id, brief_date desc);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_recruiters_updated_at
  before update on recruiters
  for each row execute function set_updated_at();

create trigger trg_clients_updated_at
  before update on clients
  for each row execute function set_updated_at();

create trigger trg_client_contacts_updated_at
  before update on client_contacts
  for each row execute function set_updated_at();

create trigger trg_roles_updated_at
  before update on roles
  for each row execute function set_updated_at();

create trigger trg_candidates_updated_at
  before update on candidates
  for each row execute function set_updated_at();

create trigger trg_pipeline_updated_at
  before update on pipeline
  for each row execute function set_updated_at();

create trigger trg_messages_updated_at
  before update on messages
  for each row execute function set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table recruiters              enable row level security;
alter table voice_samples           enable row level security;
alter table clients                 enable row level security;
alter table client_contacts         enable row level security;
alter table client_intelligence     enable row level security;
alter table roles                   enable row level security;
alter table candidates              enable row level security;
alter table pipeline                enable row level security;
alter table pipeline_stage_history  enable row level security;
alter table interactions            enable row level security;
alter table messages                enable row level security;
alter table daily_briefs            enable row level security;

-- Helper: resolve the recruiter id for the current auth session
create or replace function current_recruiter_id()
returns uuid language sql security definer stable as $$
  select id from recruiters where user_id = auth.uid() limit 1;
$$;

-- Recruiters: own row only
create policy "recruiters: own row"
  on recruiters for all
  using (user_id = auth.uid());

-- All other tables: scoped to the recruiter_id of the logged-in user
create policy "voice_samples: own data"
  on voice_samples for all
  using (recruiter_id = current_recruiter_id());

create policy "clients: own data"
  on clients for all
  using (recruiter_id = current_recruiter_id());

create policy "client_contacts: own data"
  on client_contacts for all
  using (recruiter_id = current_recruiter_id());

create policy "client_intelligence: own data"
  on client_intelligence for all
  using (recruiter_id = current_recruiter_id());

create policy "roles: own data"
  on roles for all
  using (recruiter_id = current_recruiter_id());

create policy "candidates: own data"
  on candidates for all
  using (recruiter_id = current_recruiter_id());

create policy "pipeline: own data"
  on pipeline for all
  using (recruiter_id = current_recruiter_id());

create policy "pipeline_stage_history: own data"
  on pipeline_stage_history for all
  using (recruiter_id = current_recruiter_id());

create policy "interactions: own data"
  on interactions for all
  using (recruiter_id = current_recruiter_id());

create policy "messages: own data"
  on messages for all
  using (recruiter_id = current_recruiter_id());

create policy "daily_briefs: own data"
  on daily_briefs for all
  using (recruiter_id = current_recruiter_id());
