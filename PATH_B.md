# PATH_B — Agent-Native Wren Prototype
> Read alongside WREN.md. Two-week build plan. Phases A → B → C with stop points.
>
> Goal: ship a working agent-native prototype at `/wren` that handles the hardest part of the recruiter's day — turning candidates into placements. Existing pages, skills, database, and triggers all stay. This is a new shell over the existing foundation.

---

## The thesis

**Wren turns candidates into placements.**

You know how to source. Your Sales Navigator, your network, your referrals — that's your craft and you're good at it. Wren starts the moment you have a candidate. Paste a URL, a resume, ugly LinkedIn copy — any of it works. From there, Wren handles everything between "I found them" and "they signed the offer":

- Screening and matching against your roles
- Pitch drafting and client submissions
- Multi-channel outreach with sequenced follow-ups
- Reply handling and back-and-forth
- Interview prep and debrief capture
- Objection handling with the hiring manager
- Re-engagement of candidates months later when a new role fits

Sourcing is the *visible* part of the job. Closing is the *real* part. It's where the money lives, where the relationships deepen, and where every tool in the space fails to help.

**Competitors pitch on the top of the funnel.** Find candidates faster. AI sourcing. Automated outreach at scale. But a good recruiter with Sales Navigator already knows how to source. What they lose time on is writing the submission that actually gets the interview. Remembering what the hiring manager liked last time. Following up without sounding annoying. Handling a "we passed because X." Prepping for the interview with notes they took three weeks ago they can't find. Re-engaging the candidate they talked to in August when a new role fits them. Negotiating the offer when the candidate has two others.

That's the work. Wren does it.

**The moat is the memory.** Every interaction, every submission, every objection, every debrief — captured, enriched, searchable, re-engageable. A recruiter with six months of Wren has a compounding database of who they know, what clients want, what objections repeat, what close strategies work. That's not replaceable by switching tools. Sourcing tools are replaceable. A system that knows your book of business is not.

---

## What we're building

A new route, `/wren`, that is a persistent conversation with an agent. The agent has tools (database access, existing prompt skills, URL fetching, profile enrichment). It renders rich inline cards for candidates, roles, drafts, and pipelines. It opens every session with orientation — Wren speaks first.

**The four flows:**

**Flow 1: Ingestion.** Recruiter: "Here's a candidate — [URL / resume / LinkedIn paste]." Wren ingests any format, deduplicates against the database, enriches the record, matches against open roles. The front door to every other flow.

**Flow 2: Outreach and sequencing.** Recruiter: "Draft outreach for this candidate on the Inworld role." Wren generates email + LinkedIn drafts in parallel. Tracks the sequence. 3-day and 7-day follow-ups draft on demand (cron-based in v1.1).

**Flow 3: Reply handling.** Recruiter: "Andrew replied with this." Wren reads the reply, classifies intent, drafts the appropriate response — answer the question, propose times, send the JD, escalate to human.

**Flow 4: Close the candidate.** This is the product. Three sub-flows in v1:
- **Submission to client.** Wren drafts the pitch (email + bullet formats). Tracks the send. Starts the countdown.
- **Interview prep.** Wren generates a per-call prep pack — hiring manager context, questions to ask, talking points, a reminder of the submission pitch so the candidate's positioning stays consistent.
- **Debrief and objection handling.** Recruiter pastes the client's response ("we passed because X" or "liked him, second round Tuesday"). Wren updates the pipeline, drafts the next message, captures the objection pattern for future submissions.

**These four flows share state.** Andrew enters via Flow 1. Outreach in Flow 2. Replies handled in Flow 3. When he hits the submission stage, Flow 4 takes over — pitch drafted, interview prep generated, debrief captured, re-engagement tracked. Every piece feeds the database. The database gets smarter.

**What v1 is not:**
- Not a replacement for existing pages. They stay for direct viewing.
- Not a sourcing tool. LinkedIn Recruiter / Sales Navigator stays with the recruiter.
- Not a full calendar integration. Mocked for now.
- Not fully proactive. Flow 1 orientation fires when `/wren` mounts, not on a schedule. No cron in v1.
- Not connected to email inboxes. The recruiter pastes replies into Wren in v1.
- Not a learning system yet. Logs edits but doesn't feed them back.

---

## Architecture

**Frontend:** new route `/wren`. Streaming chat UI with inline rich components.

**Backend:** new endpoint `api/wren.js`. Agent loop using Anthropic Messages API with tool use and streaming.

**Data:** new tables `conversations`, `conversation_messages`. New migration adds `submitted_at` and `last_followup_at` to `pipeline`. Plus a `debriefs` table for structured client feedback capture.

**Agent loop:**
1. Client sends user message (or the initial orientation trigger when `/wren` mounts).
2. Server loads conversation history, builds system prompt, sends to Claude with tools array.
3. Claude streams. Text relays to client. Tool_use blocks execute server-side.
4. Server feeds tool_result back. Claude continues until end_turn.
5. Persist full conversation state.

**Tools in v1 (19 total):**

Read-only:
- `search_candidates(query, limit)` — text search
- `get_candidate(id)` — full record with pipelines and recent interactions
- `search_roles(query, limit)`
- `get_role(id)` — role with pipeline summary
- `list_queue(status)` — messages by status
- `list_attention()` — overdue, cold, unscreened
- `list_active_submissions()` — pipelines with `submitted_at` set, no final outcome yet
- `match_candidates_against_role(role_id, limit)` — internal database sourcing (Flow 2 core)
- `match_roles_against_candidate(candidate_id, limit)` — surfaces open roles for a candidate (Flow 1)
- `get_client_objection_history(client_id)` — pulls past rejection reasons and debrief notes for context when pitching to this client

Mutations:
- `ingest_input(text_or_url)` — fires upgraded intake with deduplication hints
- `generate_outreach_set(candidate_id, role_id)` — fires email + LinkedIn drafts in parallel
- `generate_followup(pipeline_id, reason)` — drafts a nudge
- `generate_reply(candidate_id, reply_text)` — drafts response to an inbound candidate message
- `generate_submission(candidate_id, role_id, format)` — fires submission draft (email or bullet)
- `generate_interview_prep(pipeline_id)` — generates prep pack for upcoming interview
- `capture_debrief(pipeline_id, debrief_text)` — parses client feedback, updates pipeline, stores objection
- `queue_message(candidate_id, pipeline_id, body, subject, channel)` — writes draft to queue
- `mark_sent(message_id)` — moves draft to sent, starts countdown

Rendering:
- `render_card(type, id)` — renders inline component. Types: `candidate`, `role`, `pipeline`, `draft`, `candidate_list`, `draft_set`, `interview_prep`, `debrief_summary`.

**Inline components in v1 (6):**
- `CandidateCard` — compact: name, title/company, top fit scores, next action, signals
- `RoleCard` — compact: title, client, pipeline stage counts, top 3 candidates
- `SubmissionDraft` — editable textarea, Copy / Save to Queue / Regenerate
- `DraftSet` — container for 2-3 related drafts (email + LinkedIn)
- `InterviewPrepCard` — prep pack with collapsible sections (HM context, questions, talking points)
- `DebriefSummary` — structured view of captured feedback with next-action suggestion

---

## Phase A — Foundation (4-6 hours)

Goal: the surface exists. Messages stream. No intelligence yet.

### A.1 — Conversation persistence

New migration `20260418000000_conversations.sql`:

```sql
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
```

### A.2 — Submission tracking migration

New migration `20260418000001_pipeline_submission_tracking.sql`:

```sql
alter table pipeline
  add column if not exists submitted_at      timestamptz,
  add column if not exists last_followup_at  timestamptz;

create index on pipeline (submitted_at) where submitted_at is not null;
```

### A.3 — Debriefs table

New migration `20260418000002_debriefs.sql`:

```sql
create table debriefs (
  id               uuid primary key default gen_random_uuid(),
  recruiter_id     uuid not null references recruiters(id) on delete cascade,
  pipeline_id      uuid not null references pipeline(id) on delete cascade,
  candidate_id     uuid not null references candidates(id) on delete cascade,
  role_id          uuid not null references roles(id) on delete cascade,
  outcome          text not null check (outcome in ('advance', 'reject', 'hold', 'neutral')),
  feedback_raw     text,
  objections       jsonb,
  strengths        jsonb,
  next_action      text,
  captured_at      timestamptz not null default now()
);

create index on debriefs (candidate_id, captured_at desc);
create index on debriefs (role_id);

alter table debriefs enable row level security;

create policy "debriefs: own data"
  on debriefs for all using (recruiter_id = current_recruiter_id());
```

### A.4 — Route and shell

- Route `/wren` in `App.jsx`, protected.
- New page `src/pages/Wren.jsx`.
- Layout: left sidebar with conversation list ("New conversation" button at top). Main area: message stream with composer at bottom.
- Follow existing design tokens.

### A.5 — Composer and message stream

- Text input at bottom, Cmd+Enter to send.
- Messages as chat bubbles. User right, agent left.
- Agent bubbles support markdown.
- Auto-scroll on new message.
- Loading state: three-dot pulsing in a ghost agent bubble.

### A.6 — Echo endpoint

- New `api/wren.js` that echoes the input.
- Wire composer. Persist both messages. Return echo.

### Acceptance for Phase A
- Navigate to `/wren`. Create a new conversation. Type a message. See echo. Refresh. Persists.
- Second conversation works independently.

**Stop here. Shell either feels right or it doesn't. Don't build the agent until it does.**

---

## Phase B — The agent loop (8-10 hours)

Goal: Wren answers questions about your database. Real tool use. Read-only.

### B.1 — Agent loop endpoint

Rewrite `api/wren.js` as the agent endpoint. Anthropic SDK streaming interface. Handle text deltas and tool_use blocks. On tool_use, stream a "checking..." indicator, execute server-side, feed result back.

Model: `claude-sonnet-4-6`.

### B.2 — System prompt

New file `src/lib/prompts/wrenAgent.js`. Defines:
- Wren's persona: tight, specific, human voice. No AI tells. Reuses writing rules from existing prompts.
- The four flows (brief, not procedural)
- Tool use patterns: call proactively for read-only, never ask permission to look something up
- When to render cards vs. respond in text
- Initiative pattern: on orientation trigger, call `list_attention()` and `list_queue('drafted')` and `list_active_submissions()` before responding
- The thesis: Wren turns candidates into placements. Every response should push toward that outcome.

Keep under 1500 tokens. Voice matters more than length.

### B.3 — Read-only tools (10)

Implement as Supabase queries scoped to recruiter. All 10 from the tools list above. `match_candidates_against_role` and `match_roles_against_candidate` both loop active records with `cv_text`, call `resumeScreener.js`, stack-rank.

`get_client_objection_history` is new — pulls from the `debriefs` table (empty in v1, populates over time) plus any `pipeline.fit_score_rationale` notes on rejected pipelines.

### B.4 — First card: CandidateCard

- New component `src/components/wren/CandidateCard.jsx` — compact view.
- `render_card(type='candidate', id)` tool returns a directive. Client renders the component inline.

### B.5 — Initiative on conversation open

When `/wren` mounts and no conversation is selected, create a new conversation. Send a trigger like `"__orientation__"` that the system prompt recognizes.

Agent calls `list_attention()`, `list_queue('drafted')`, `list_active_submissions()`, synthesizes a morning brief, renders any urgent cards inline.

### Acceptance for Phase B
- Wren opens with: "Morning. You have 2 submissions waiting on client response (Inworld, Workhelix), 3 overdue candidate actions, 1 draft in queue." (Or similar.)
- "Tell me about Andrew Plesman." → CandidateCard inline.
- "Who fits the Inworld role?" → stack-ranked list with cards.
- "What's in my queue?" → summary.
- "How has Inworld reacted to previous submissions?" → reads from debriefs, summarizes patterns.

**Stop here. Use it for 2-3 days before Phase C.**

---

## Phase C — The four flows (18-24 hours)

Goal: all four flows work end to end. Editable drafts inline. The closing work lives in the agent.

### C.1 — Upgrade intake for deduplication (prerequisite)

Current `intake.js` returns candidate data but no deduplication hints. This is why you've been getting duplicate records.

Update `intake.js` to:
- Receive existing candidates (last 50 by `updated_at`) and clients list, same pattern as session 14's role matching
- Match by meaning — "Andrew from Inworld" resolves to existing Andrew
- Return `candidate_id` and `client_id` when matches are found
- Return `candidate_match_hints` block for agent-side verification

Agent uses hints directly. Creates new records only when matches are null.

This fixes half the friction from the current product.

### C.2 — Flow 1: Ingestion (the front door)

Tool: `ingest_input(text_or_url)`.

Handles every input format:
- Plain text (paste)
- URL (fetch via `api/fetch-url`)
- PDF (base64 → Claude vision extraction, reusing `cvExtraction.js`)
- DOCX (mammoth extraction, client-side)
- Ugly LinkedIn copy (Sales Navigator output, emoji-heavy profiles, ragged formatting) — the upgraded intake prompt handles these

Flow:
- User pastes or uploads.
- Wren: "Looks like Andrew Plesman at Foobar Inc. Let me check if I know him."
- Calls `search_candidates` using match hints. Either updates existing or creates new.
- Calls `match_roles_against_candidate`. Returns top open-role fits.
- Renders CandidateCard + role matches inline.
- Offers: "Want to draft outreach or a submission?"

**Test criterion for ingestion: paste 15 different messy inputs (LinkedIn copy with ads mixed in, partial resumes, URLs, screenshots transcribed to text). Wren handles all of them without asking the recruiter to reformat.**

### C.3 — Flow 2: Outreach with sequencing

Tool: `generate_outreach_set(candidate_id, role_id)`.

Fires two existing prompts in parallel:
- `candidateOutreachEmail.js` → email (subject + body)
- `linkedinMessageGenerator.js` → LinkedIn message

Returns both. Renders as DraftSet inline, both editable.

Tool: `generate_followup(pipeline_id, reason)`.

New prompt file `src/lib/prompts/followupOutreach.js`. Reasons: `no_response_3d`, `no_response_7d`, `reengagement`. Different angle each time.

In v1, manual trigger: user asks Wren "draft a follow-up for Andrew on Inworld."

In v1.1 (not this build): cron fires automatically when countdown hits.

### C.4 — Flow 3: Reply handling

Tool: `generate_reply(candidate_id, reply_text)`.

New prompt file `src/lib/prompts/candidateReply.js`. Returns:
```json
{
  "intent": "question | interested | hesitant | not_interested | scheduling",
  "draft_response": "...",
  "confidence": 0.0-1.0,
  "handoff_recommended": true | false,
  "handoff_reason": "..."
}
```

Flow:
- User pastes reply.
- Wren classifies, drafts response, renders SubmissionDraft inline.
- User edits, saves to queue.

### C.5 — Flow 4a: Submission to client

Tool: `generate_submission(candidate_id, role_id, format)`.

Reuses existing `submissionDraft.js`. Format: `email` or `bullet`.

Key upgrade: before generating, the tool calls `get_client_objection_history(client_id)` and injects past objections into the submission prompt. If the client has repeatedly rejected candidates for "not enough enterprise sales experience," the pitch pre-addresses that concern.

Flow:
- User: "Draft the submission for Andrew on Inworld."
- Wren checks objection history. "Inworld passed on two earlier candidates for lack of developer-tool experience. I'll lead with Andrew's time at Twilio."
- Generates submission, renders SubmissionDraft inline.
- User edits, saves to queue, sends.
- `mark_sent` tool moves message to sent, sets `pipeline.submitted_at = now()`.

### C.6 — Flow 4b: Interview prep

Tool: `generate_interview_prep(pipeline_id)`.

New prompt file `src/lib/prompts/interviewPrep.js`. Receives:
- Candidate record (cv_text, career_timeline, signals)
- Role (JD, process_steps, interview_guide)
- Submission pitch that was sent (reminds the candidate's positioning)
- Client context (company intelligence, objection history)

Returns:
- Hiring manager background (name, role, tenure at company)
- 3 questions Andrew should ask
- 2 things to avoid (based on past rejections or known client preferences)
- Talking points that reinforce the submission pitch
- 1-sentence "what good looks like" for this interview stage

Renders as InterviewPrepCard with collapsible sections.

Flow:
- User: "Andrew's interviewing with Inworld tomorrow. Prep me."
- Wren generates prep pack, renders inline.
- User shares with candidate (Copy → paste → send).

### C.7 — Flow 4c: Debrief and objection capture

Tool: `capture_debrief(pipeline_id, debrief_text)`.

New prompt file `src/lib/prompts/debriefParser.js`. Receives the client's feedback (pasted by recruiter). Extracts:
```json
{
  "outcome": "advance | reject | hold | neutral",
  "strengths": ["..."],
  "objections": [{ "theme": "...", "detail": "..." }],
  "next_action": "...",
  "client_tone": "warm | neutral | cool"
}
```

Writes to `debriefs` table. Updates `pipeline.current_stage` and `pipeline.status` based on outcome. Logs an `interaction` entry with the raw feedback.

Flow:
- User: "Debrief from Inworld on Andrew: 'Strong background but we're worried about his lack of Bay Area network. Going to pass but keep him warm.'"
- Wren calls `capture_debrief`. Renders DebriefSummary inline.
- Wren: "Logged. I'll flag this objection pattern for future Inworld submissions. Andrew's moved to rejected status with a warm-keep note. Want me to draft a re-engagement for when the next Bay Area-heavy role comes in?"
- The objection now shows up in `get_client_objection_history` for next time.

### C.8 — Editable draft component

- `src/components/wren/SubmissionDraft.jsx`.
- Editable textarea.
- Actions: Copy, Save to Queue, Regenerate, Mark Sent.
- Log edit diffs as metadata (for v2 edit-learning).

### C.9 — RoleCard, InterviewPrepCard, DebriefSummary

- `src/components/wren/RoleCard.jsx`
- `src/components/wren/InterviewPrepCard.jsx` — collapsible sections
- `src/components/wren/DebriefSummary.jsx` — structured view

### C.10 — System prompt iteration

With tools live, spend real time on `wrenAgent.js`:
- Test each flow end to end
- Observe where Wren feels stiff or asks too many questions
- Encode patterns: lead with observation, proactive read-only tool calls, concrete next actions, human voice

**The prompt is the product.** Budget real time here — probably 3-4 hours alone.

### Acceptance for Phase C

Walk through a full placement cycle in `/wren`:

- **Day 1:** Morning orientation. "Andrew Plesman replied yes to outreach." Paste his profile. Wren ingests, matches against Inworld role, renders card. Draft submission — Wren checks objection history, generates pitch, renders inline. Edit, save, mark sent.
- **Day 3:** No response from Inworld. Ask for follow-up. Wren drafts nudge. Save to queue.
- **Day 5:** Inworld replies — wants to interview Andrew. Paste the reply. Wren classifies, drafts response. Save, send.
- **Day 8:** Interview tomorrow. "Prep me." Wren generates prep pack. Share with Andrew.
- **Day 10:** Debrief from Inworld. Paste feedback. Wren parses, updates pipeline, captures objections. Suggests next moves.
- **Week later:** New role comes in. Wren's morning brief: "Inworld role similar to the one Andrew didn't land. Want to re-engage him?"

If this runs without leaving `/wren`, Phase C is done.

---

## LinkedIn enrichment strategy

**Proxycurl is dead** as of July 2025 (LinkedIn lawsuit).

**v1 approach: paste-first, API-second.**
- Primary: recruiter pastes LinkedIn URL or profile text.
- If URL: `api/fetch-url.js` tries first. If login-walled, fall back to Apify LinkedIn Scrapers.
- Apify cost: ~$0.005-0.01 per profile. 200 profiles/month = $1-2. Cheap enough to include in subscription.

**Positioning:** Wren enriches candidates you care about. Your database is the moat. LinkedIn is a source, not the source.

**Build with swappability.** `enrichProfile(url)` interface with Apify as one provider. If any provider goes down, swap without rewriting.

---

## Deferred for v1.1 and beyond

- Real calendar integration (Google OAuth, daily sync)
- Scheduled initiative (cron for daily briefs, stale followup drafts)
- Edit-learning feeding back into prompts as voice samples
- Gmail inbox integration for automatic reply ingestion
- Voice/audio input
- Mobile-optimized layout
- Company intelligence enrichment on client create
- Offer-stage flow (when candidate has multiple offers)
- Candidate re-engagement as an automated trigger (v1 has it as agent suggestion, v1.1 is auto-surface)
- Multi-provider enrichment abstraction
- Discovery sourcing (net-new candidates, not already in database)

---

## Order of operations

1. **Tonight:** Fix the C++ regex crash in `booleanSearchBuilder.js`. Clear duplicate Inworld and test records. Nothing else.
2. **Tomorrow:** Walk through the Andrew flow with the existing product. Take aspiration notes.
3. **Session 1 of Path B:** Phase A. 4-6 hours.
4. **Sessions 2-3:** Phase B. Two evenings.
5. **Sessions 4-8:** Phase C. Five evenings or three weekend sessions. Flow 4 adds ~6 hours vs the 3-flow version.
6. **Daily use for 3 days.**
7. **Triage.** What works, what doesn't, what's next.

**Total budget: 30-40 hours across two weeks.** Flow 4 pushes the high end. That's fine — it's the flow that makes the product real.

---

## Business model check-in

Target: $199-299/month per solo recruiter.

Per-user economics at $249/month:
- Anthropic Sonnet 4.6: ~$3/M input, $15/M output. Agent loop averages 5-10 tool calls per interaction. Heavy recruiter using Wren 30 hours/month: $15-60/month API cost.
- Enrichment (Apify): $1-5/month typical
- Supabase + Vercel: flat $50-100/month until ~100 users

**Per-user gross margin: $180-230.** 500 users = $90-115k MRR at 80% GM.

The business works only if Wren delivers 10+ hours/week back to the recruiter. The four flows target exactly that — sourcing stays the recruiter's job, closing becomes Wren's job. Build to that bar.

---

## The thing to remember

Sourcing is the visible part of the job. Closing is the real one.

Nobody is building for the second half. Every tool in the space competes on "find candidates faster." None of them help you turn a candidate into a placement. That's the gap. Ship into the gap.

Existing pages keep working. Real-use audit continues on existing surfaces. Agent surface gets built alongside — not instead of. Both mature in parallel.

Four flows. One surface. Two weeks. Ship it.
