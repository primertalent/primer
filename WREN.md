# WREN — Master Context Document
> Read this at the start of every Claude Code session. Keep it current. Last updated: 2026-04-15 (session 15).

---

## What Wren Actually Is

Wren is the recruiting hire you couldn't afford to make.

It works your desk while you're on a call, with a client, at your kid's soccer game. It screens candidates, drafts submissions, flags what needs attention, and keeps the database current. When you come back, the work is done. You make the calls. You build the relationships. You close the deals. Wren handles everything in between.

**Not an OS. Not a co-pilot. Not a chatbot.**
An agent with real recruiter logic and a platform to execute and store it.

Two layers working together:
- **The agent** — recruiter logic encoded from real recruiters, fires on events, works without being asked
- **The platform** — stores every candidate, role, interaction, score, and signal so the agent gets smarter over time

The agent is useless without the platform. The platform is just an ATS without the agent. Together they compound.

**The model:** Human first, AI in the middle, human last. The recruiter opens their day with a brief, works their roles, closes with a queue of actions to review. The agent fills everything in between. Over time, the middle expands.

---

## The Recruiter Logic Layer (The Brain)

Wren's intelligence comes from 7 prompt modules built on frameworks from real recruiters. These are not features. They are skills. The platform exists to give these skills context, memory, and a place to execute.

Current skills in `src/lib/prompts/`:

| Skill | File | What It Does |
|---|---|---|
| Resume Screener | `resumeScreener.js` | Scores candidate against role, flags red flags, strengths, trajectory |
| Candidate Pitch Builder | `candidatePitchBuilder.js` | 3-paragraph client submission pitch for hiring managers |
| Outreach Email | `candidateOutreachEmail.js` | Personalized cold outreach email to candidate |
| LinkedIn Message | `linkedinMessageGenerator.js` | Short LinkedIn message, under 300 characters |
| Interview Questions | `interviewQuestionGenerator.js` | Tailored questions with signal notes from JD + candidate profile |
| Boolean Search Builder | `booleanSearchBuilder.js` | LinkedIn, Google X-Ray, and GitHub search strings from role requirements |
| Evaluation Scorecard | `candidateScorecard.js` | Structured deep evaluation: experience, skills, trajectory, culture, red flags |
| Job Description Writer | `jobDescriptionWriter.js` | Clean JD from rough notes or client intake |
| Intake | `intake.js` | Full record creation from any input — resume, JD, transcript, notes |
| Next Action | (inline in api/ai.js) | Surfaces the most important next step on any candidate |
| Submission Draft | `submissionDraft.js` | Email or bullet format client submission draft |
| Career Parser | (inline in api/ai.js) | Extracts career timeline and signals from cv_text |

**The shift that needs to happen:**
Right now every skill fires when a button is clicked. The agent version fires skills on events — candidate added to pipeline, role created, stage advanced, time elapsed. The skills don't change. The trigger does. Button press becomes event. That is the path from tool to agent.

---

## The Agent Roadmap (Where This Goes)

**Today:** Skills fire on button press. Recruiter invokes the brain.

**Next:** Skills fire on events. Brain runs without being asked.
- Candidate added to pipeline → screener runs automatically
- New role created → search strings generate, JD formats, interview questions queue
- Candidate hits 5 days no contact → brief flags it, follow-up drafts
- Candidate advances to interview stage → interview prep generates
- Submission draft sits in queue 48 hours → brief surfaces it

**Later:** Wren works overnight.
- Screens resumes that arrived while you were away
- Drafts client submissions for candidates ready to move
- Queues follow-ups for cold candidates
- Preps call briefs for tomorrow's scheduled conversations
- Surfaces an S-Tier candidate and tells you to move fast

**The soccer game version** (buildable now with 3 triggers and a queue):
You leave at 3pm. Wren screens, drafts, queues. You get home, open the brief, approve what looks right, copy and send. Fifteen minutes closes the day.

---

## Channel Philosophy

Wren is channel-agnostic. It drafts. The recruiter delivers.

**Client submissions** are compelling candidate pitches sent to hiring managers. The channel — Paraform, email, ATS portal, LinkedIn message, PDF — is the recruiter's choice. Wren's job is to make the pitch better than what a tired recruiter writes at 4pm. Never reference Paraform as a product concept. Ryan uses Paraform today. Other recruiters don't.

**Outreach** is drafted inside Wren, copied and sent by the recruiter. LinkedIn has no API and actively blocks automation. The Chrome extension is the v2 play for frictionless LinkedIn actions. For now: draft in Wren, one copy motion to send.

**Email** is the most automatable channel. Wren can draft and eventually send via Gmail integration. This is the first real autonomous outreach path.

---

## Stack

| Layer | Tool |
|---|---|
| Frontend | React + Vite |
| Database + Auth | Supabase |
| Hosting | Vercel |
| AI | Anthropic API — claude-sonnet-4-6 |
| Serverless | api/ai.js (Vercel serverless functions) |

- Repo: github.com/primertalent/primer
- Live: primer-rosy-two.vercel.app
- Local: C:/Users/Ryan McGuinness/primer
- Run locally: `cd ~/primer && claude`
- Dev server: http://localhost:5173 (sometimes 5175)
- ANTHROPIC_API_KEY is server-side only, never exposed to client

---

## What's Built and Working

- Auth (Supabase)
- Brief as homepage — activity digest, needs attention, active roles by pipeline stage
- Candidate database table — sort, filter, fit score badges
- Candidate card — AI next action, resume screener, career timeline, tenure summary, signal badges, scores history
- CV upload — full text extraction (PDF + DOCX), cv_text saved to candidates table
- Candidate edit page at /candidates/:id/edit
- Role setup — JD scraper (paste URL or upload PDF)
- Role detail — kanban pipeline board + JD display
- One-click stage advance on kanban cards (no page nav required)
- Client list and client detail with contacts
- Approve and send queue
- Delete on all records with confirmation modals
- Back navigation goes to logical parent (not browser history)
- Nav order: Home → Roles → Candidates → Queue → Clients
- Career timeline saves to `career_timeline` JSONB column on candidates table
- Career signals save to `career_signals` JSONB column on candidates table
- Screener fit score saves to `pipeline` table after screening
- **Client submission drafting** — ✉ button on each kanban card in RoleDetail. Fetches full candidate record, calls AI with JD context. Modal with Email/Bullet format toggle, editable textarea, Save to Queue or Copy. Saved drafts appear in /queue as status: drafted.
- **Bidirectional pipeline movement** — ← and → buttons on every kanban card. ← only appears when there's a previous stage, → only when there's a next. Optimistic UI with rollback on error.
- **Two submission formats** — Email (narrative, under 250 words) and Bullet (structured plain-text bullets, under 150 words). Toggle appears before generation and after.
- **Submission draft on Candidate Card** — "Draft Submission" button in the page header. Supports JD Specific (pick a pipeline role, pulls its JD) or Generic (candidate record only). Same modal pattern: format toggle, Generate, editable textarea, Save to Queue or Copy.
- **Screener result persistence** — full AI screener output saves to `screener_results` table on every run regardless of pipeline status. Pre-pipeline badge shown for evaluations before candidate was added to a role.
- **Scorecard result persistence** — full scorecard output saves to `pipeline.scorecard_result` JSONB column on generation.
- **Interaction logging UI** — inline form on candidate card. Type (Call / Email / Note), Direction, Date, Notes. Saves to `interactions` table. Most-recent-first.
- **Stage advance from candidate card** — each pipeline entry row has a one-click advance button. Updates `pipeline.current_stage`, inserts into `pipeline_stage_history`, optimistic UI with rollback.
- **Wren Command Bar** — persistent input on the Brief page. Accepts paste, file attachment (PDF + DOCX), or any combination. Auto-classifies inputs into chips (Resume, JD, Transcript, Notes). Runs full intake in one pass: candidate + company + role created or matched, screener scored, call signals extracted, interaction logged, pipeline entry created. Save All writes all records to Supabase. ✕ Clear resets to input.
- **Recruiter judgment layer** — recruiter score (1-10) + note on every pipeline entry. Persists to `pipeline.recruiter_score` and `pipeline.recruiter_note`. Never touched by AI reruns. Purple badge displayed alongside AI fit score. Delta between AI and recruiter score is preserved — both visible simultaneously.
- **Edit/Delete everything** — every AI-generated or user-logged record is deletable inline. × button on hover → inline confirm → optimistic delete with rollback.
- **Multi-screen mode** — WrenCommand auto-detects 1 resume + 2+ JD chips, routes to comparative AI call. Stack-ranked cards with graduated recommendations. Save All loops all rankings into pipeline and screener_results.
- **Per-card pitch generation** — each multi-screen ranking card has a "Generate Pitch" button. Returns email pitch and bullets simultaneously. Copy and Save to Queue per format.
- **JD text saved from chips** — JD chip raw text saves to `roles.notes` when role is created via WrenCommand.
- **Interview guide persistence** — saves to `roles.interview_guide` JSONB column. Reloads on every visit.
- **JD format button** — cleanup AI pass on raw scraped text, saves back to `roles.notes`.
- **Unscreened badge** — yellow badge in Fit column for pipeline candidates with no fit score.
- **Promise.allSettled in CandidateCard** — partial data degrades gracefully, candidate always loads.
- **Human writing rules** — applied across all prompt files. No em dashes, no AI cliché vocabulary. Every prompt writes like a recruiter talking to a colleague.
- **Auto-screen on pipeline add** — when a candidate is added to a role from CandidateCard, screener fires automatically in the background. Saves to `screener_results`, writes `fit_score` and `fit_score_rationale` to the pipeline entry. Silent skip if candidate has no `cv_text` or role has no JD. No UI block.
- **Auto-regenerate next action on stage advance** — when a stage advance succeeds in CandidateCard, next action prompt fires in the background with updated pipeline context. Saves to `candidates.enrichment_data.next_action`, updates card state live. Silent skip on any failure. Brief reflects updated action by next load.
- **Auto-generate search strings on role create** — fires in background after role save in CreateRole, before redirect. Silent skip if no JD text. Strings ready in RoleDetail when recruiter arrives.
- **Semantic role matching in WrenCommand intake** — before intake fires, all open roles are fetched and injected into the system prompt. Model matches by meaning: "GTM lead" resolves to "Go-to-market lead", abbreviations and alternate titles all resolve correctly. Returns `role_id` in the intake result. Save All uses it directly, skips DB lookup and insert. Falls back to ilike match then create only if `role_id` is null. Confirmed in real use.
- **UI pass (session 15)** — full reshape across all surfaces. No new features, everything reshaped against the "what do I do next" principle:
  - Needs Attention cards: two-button layout (filled primary action + ghost View), name bold at top, signal colored by variant. Action labels map to intent: Draft Follow-Up, Run Screener, Set Action, Review Queue.
  - Kanban cards: fit_score_rationale shown as signal, next_action always visible at card bottom. Pipeline query expanded to include both fields.
  - Queue: inbox-clear feel. Candidate name + role prominent, first sentence preview only. Drafted items: Edit / Approve & Copy / Hold. Empty state: "You're clear. Nothing waiting." Skeleton loading.
  - WrenCommand output: decision-ready packet. Hero name + fit score large, Strengths (3 max from pitch bullets), Concerns (2 max from red flags), Next Action bold with sage accent. Save All + View Candidate after save.
  - Candidate card: replaced 3-column grid with sticky context bar + single column. Sticky bar shows name, scores, next action at all times. Single column order: Details, Signals, Career Timeline, Resume Screener, Scores History, Pipeline, Interactions.
  - Visual system: shimmer skeleton on all Dashboard and Queue loading states. Fade-in on intake results. Warm background and sage accent applied consistently.

---

## Database (Supabase)

Key tables:
- `recruiters` — auth user profile
- `candidates` — full candidate record including `cv_text`, `career_timeline` (JSONB), `career_signals` (JSONB), `fit_score`
- `roles` — open positions, linked to clients, includes `jd_text`, `process_steps`, `interview_guide` (JSONB)
- `pipeline` — candidate × role junction. Tracks `current_stage`, `fit_score`, `recruiter_score`, `recruiter_note`, stage history, `scorecard_result` (JSONB)
- `clients` — companies, with contacts
- `client_contacts` — contacts linked to clients
- `interactions` — permanent record of all touchpoints
- `screener_results` — standalone screener run history per candidate × role, no pipeline dependency
- `messages` — drafted/queued outreach (status: drafted, approved, sent, held)
- `daily_briefs` — morning brief data

---

## Key Components

- `MorningBrief.jsx` — Brief/homepage. ActivityDigest, NeedsAttention, TodayPipeline, WrenCommand
- `WrenCommand.jsx` — command bar. Two components: WrenCommand (input + chips + file attach) and IntakeResult (structured output with Save All)
- `CandidateCard.jsx` — main candidate view. Career timeline, screener, signal badges, scores history, next action, interactions, pipeline entries
- `RoleDetail.jsx` — role view with kanban pipeline board, search strings, interview questions, JD
- `Candidates.jsx` — candidate database table
- `ClientDetail.jsx` — client view with contacts
- `api/ai.js` — all Anthropic API calls, server-side only. Actions: intake, classify, screen, scorecard, submission_draft, career_parse, next_action
- `src/lib/prompts/` — all recruiter logic lives here. See skill table above.

---

## Product Principles (Non-Negotiable)

**Wren is the hire you couldn't make.**
It works the desk while you're away. Every feature should make that more true, not less. If it doesn't move a candidate, close a role, or save the recruiter from a manual task, it doesn't ship.

**Human first, AI in the middle, human last.**
Recruiter sets direction. Wren executes. Recruiter approves and delivers. The middle is where Wren lives and the middle keeps expanding.

**The agent fires on events, not buttons.**
Every skill that currently fires on button press is a candidate for automation. The question is always: what event should trigger this? Not: where does this button live?

**Dirty data in, clean intelligence out.**
Wren takes whatever it gets and makes it useful. Never refuse incomplete data. Extract what's there, flag what's missing, move forward.

**The candidate database is the asset.**
Every interaction, score, and note makes the record richer. The database should feel like it's building itself. This is the moat. A recruiter with 6 months of data in Wren does not switch to anything else.

**Enrich over time.**
Nothing is ever finished. A candidate record gets better every time you touch it. Design everything to accumulate value, not just store data.

**Speed is respect.**
A recruiter's time is their inventory. One click. One motion. If it takes more than one motion, redesign it.

**Build for the solo recruiter first.**
No team features, no admin panels, no enterprise complexity. One person, alone, moving fast, juggling 10 roles and 50 candidates. Every feature serves that person or it doesn't ship.

**Real use beats perfect design.**
Ryan uses Wren on real roles with real candidates. Every bug found in real use is worth more than 10 features built in theory.

**Show don't ask.**
Wren surfaces what matters without being asked. The recruiter opens a record and knows what to do next without hunting for context.

**Channel-agnostic always.**
Wren drafts. The recruiter delivers. Never build for a specific platform when the concept is universal.

---

## Wren v1 — The Perfect Daily Workflow (Behavioral Spec)

This is the target experience. Every build decision should make this workflow faster and lower-friction.

### 7:45am — Ryan opens Wren

He lands on the Brief. It answers three questions without scrolling:

**What happened since yesterday?**
New candidates processed. Stages advanced. Screeners run. Interactions logged. Five lines max.

**What needs attention right now?**
Candidates who went cold. Roles with no movement in 5+ days. Unscreened pipeline entries. Drafts waiting in queue. Every item is a direct link. One click to the thing that needs action.

**What does today look like?**
Active roles with pipeline stage breakdown. Next actions queued. Time-sensitive items at the top.

Total time on the Brief: 90 seconds.

### 8:00am — He works his roles

Clicks into a role from the Brief. Kanban shows every candidate with fit score, recruiter score, unscreened badge. He clicks a card. Next action is already generated. He clicks Draft Submission. Modal opens pre-filled. Edits one sentence. Saves to Queue. Total time on that candidate: 4 minutes.

Advances two other candidates with single arrow clicks. No page loads.

### 9:30am — New resume arrives

Drops it into WrenCommand with the JD URL. Wren classifies, runs intake, returns candidate record, fit score, signals, red flags, next action, submission draft in both formats. Save All. Done. Total time: 3 minutes.

### 11:00am — Client call

Checks the client record before dialing. Last interaction, open roles, candidates in flight. Makes the call. Logs rough notes while talking. Saves on hang-up.

### 2:00pm — Candidate calls back

Logs interaction. Adds recruiter score: 8. Note: "Strong communicator. More senior than the resume reads." AI scored a 6. Delta stored. Ryan moves on.

### 4:30pm — End of day

Opens Queue. Three client submissions waiting. Reads, edits one, approves all three. Copies into email or submission portal. Queue is clean. Closes Wren.

### What Wren did while Ryan worked

Classified and parsed two resumes. Scored four candidates against three roles. Generated three submission drafts. Logged five interactions. Surfaced two needs-attention items Ryan would have missed. Updated six pipeline records. Kept the database current without a single manual data entry.

**The Brief is the start. The Queue is the end. Everything in between is Wren.**

---

## Build Test (Run This Before Every Feature)

- Does it serve the daily workflow above?
- Does it fire on an event or require a button press? (Event is better.)
- Does it reduce cognitive load or add to it?
- Can it be done in one motion?
- Does it compound toward the autonomous agent vision?
- Is it channel-agnostic?

If any answer is wrong, redesign or defer.

---

## External Review — Standing Constraints

These apply to every future build decision.

**WrenCommand is the highest-leverage surface.** Do not complicate it.

**Everything persists.** Ephemeral AI output is an antipattern. Every skill result, note, score, and draft is stored. Always.

**One-click is the bar.** Any flow that takes more than one motion gets flagged for redesign.

**Too many surfaces is a risk.** New surfaces need a strong case. The recruiter should never wonder which screen to go to.

**AI generates a lot but prioritization is the real job.** The Brief and Needs Attention are where this gets solved. They are the core loop, not a dashboard feature.

**The recruiter vs. AI delta is data.** `pipeline.recruiter_score` vs `pipeline.fit_score`. Don't build the surfacing yet. Don't block it either.

---

## Current Priority Queue

### Next build priorities

**Priority 1 — Brief Needs Attention quality.**
Already built. Audit against the behavioral spec. Should answer: who is at risk, who is hot, what is stalled, what is unscreened, drafts waiting. Every item a direct link. No scrolling.

**Priority 2 — Queue as end-of-day close.**
The Queue should feel like a clean close. Review, approve, copy, done. Audit it against the 4:30pm workflow step.

---

_Completed session 15:_ Full UI pass — sticky candidate card, attention cards, queue inbox, intake packet, skeleton loading, visual system consistency.

_Completed session 14:_ Semantic role matching in WrenCommand intake — roles fetched before intake fires, model matches by meaning not string, confirmed in real use. Bug: "GTM lead" was creating a new role instead of matching "Go-to-market lead at Inworld".

_Completed session 13:_ Three event-based triggers: auto-screen on pipeline add, auto-regenerate next action on stage advance, silent skip guard on auto search string generation.

_Completed session 12:_ Product reframe — Wren is an agent with a platform, not an OS. Agent/platform framing, skill layer documentation, channel philosophy, brain/button distinction. Paraform renamed to client submission everywhere.

_Completed session 11b:_ Brief overhaul (ActivityDigest, NeedsAttention, TodayPipeline), speed audit, surface audit, nav reorder, queue default to drafted tab, CandidateCard header reorder.

_Completed session 11:_ External review constraints added. Daily workflow behavioral spec written. Product thinking section added.

_Completed session 10:_ Multi-screen prompt quality, per-card pitch, next action setter, role close/reopen, queue Copy & Send, DB-level candidate search, pitch save, next action recruiter override, always-on Needs Attention, brief renamed to Wren, 4-hour localStorage cache, revenue-first brief prompt.

_Completed session 9:_ Multi-screen mode, inline submission draft, JD text from chips, interview guide persistence, JD format button, unscreened badge, LinkedIn recruiter name, Promise.allSettled, human writing rules.

_Completed session 8:_ Recruiter judgment layer.

_Completed session 7:_ Edit/delete everything.

_Completed session 6:_ Full product polish pass.

---

## Decisions Log

- **Wren is an agent with a platform, not an OS.** The OS framing was accurate technically but wrong as a product concept. The right frame: an agent with real recruiter logic and a platform to execute and store it. The agent is useless without the platform. The platform is just an ATS without the agent.
- **Client submission, not Paraform submission.** Wren is channel-agnostic. It drafts the pitch. The recruiter chooses how to deliver it. Never build for a specific submission platform.
- **Skills fire on events, not buttons.** Every prompt module that currently requires a button press is a candidate for event-based automation. This is the path from tool to agent.
- **The 7 skills are the brain.** Built on real recruiter logic from real recruiters. This is the moat. Anyone building a competing product has to hire the same people and extract the same logic. Protect it, extend it, never dilute it.
- **Recruiter score and AI score are separate permanent tracks.** `pipeline.recruiter_score` and `pipeline.recruiter_note` are never touched by AI reruns. Both visible. Delta is meaningful calibration data.
- **Inline confirm is the delete pattern.** No modals. One click surfaces Yes / Cancel inline. Error shown inline on failure.
- **× button appears on hover.** Keeps UI clean without sacrificing discoverability.
- **Regenerate vs. Clear distinction.** Regenerate = overwrite in place, no confirm. Clear = wipe from DB, requires confirm.
- **Save All confirmation pattern.** After successful save, action button replaced by static "Saved ✓" label. Permanent and final.
- **AI calls are server-side only.** All Anthropic API calls go through api/ai.js. Key never touches the client. Non-negotiable.
- **JSONB for flexible data.** Career timeline, career signals, process steps, interview guide use JSONB so structure can evolve without migrations.
- **No LinkedIn API.** Too locked down. Draft in Wren, copy to send. Chrome extension is the v2 play.
- **Document block pattern for multi-input AI calls.** Multiple inputs wrapped as labeled `<document>` blocks with type and name attributes. Standard for all future multi-input features.
- **Classify call is intentionally minimal.** 100 token max, 2000 char input slice. Speed over completeness. Never block the UI waiting on classification.
- **Role matching is semantic, not string.** The intake prompt receives all existing open roles before firing. The model matches by meaning. "GTM" = "Go-to-market", "VP Sales" = "Head of Sales". A `role_id` in the intake result means a match was found — use it directly, skip all lookups and inserts. Only create a new role when `role_id` is null.
- **Time-elapsed triggers are a separate architecture pattern.** Event-based triggers (pipeline add, stage advance, role create) fire synchronously off user actions and require no infra beyond what's already in place. Time-elapsed triggers (5 days no contact, submission sitting 48 hours) require scheduled jobs — a cron layer, a background worker, or Supabase Edge Functions on a timer. Do not build time-elapsed triggers until the event-based triggers are proven in real use.

---

## How to Start a Session

In Claude Code:
```
read WREN.md
```
Then state what you're building. Full context, no re-briefing needed.

After each session update:
- What's Built and Working (new features)
- Known Bugs / Recent Fixes (fixes)
- Current Priority Queue (reorder or complete items)
- Decisions Log (new architectural or product decisions)
