create table conversations (
  id           uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references recruiters(id) on delete cascade,
  title        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table conversation_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  recruiter_id    uuid not null references recruiters(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'tool')),
  content         jsonb not null,
  created_at      timestamptz not null default now()
);

create index on conversations (recruiter_id, updated_at desc);
create index on conversation_messages (conversation_id, created_at asc);

alter table conversations           enable row level security;
alter table conversation_messages   enable row level security;

create policy "conversations: own data"
  on conversations for all using (recruiter_id = current_recruiter_id());

create policy "conversation_messages: own data"
  on conversation_messages for all using (recruiter_id = current_recruiter_id());

create trigger trg_conversations_updated_at
  before update on conversations
  for each row execute function set_updated_at();
