# WREN — Master Context Document
> Read this at the start of every Claude Code session. Keep it current. Last updated: 2026-04-15 (session 11b).

---

## What is Wren

Wren is an AI-native OS for solo independent recruiters. Built by Ryan McGuinness, solo recruiter at Primer Talent LLC. Lives at hirewren.com.

Not a co-pilot. Not a chatbot. An operating system that handles the work between human touchpoints so the recruiter can focus on the relationships that close deals.

**The model:** Human first, AI in the middle, human last. Recruiter opens their day with a brief, works their roles, closes with a queue of actions to review. AI fills everything in between.

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
- Morning brief with clickable stat cards
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
- Nav order: Brief → Clients → Roles → Candidates → Queue
- Career timeline saves to `career_timeline` JSONB column on candidates table
- Career signals save to `career_signals` JSONB column on candidates table
- Screener fit score saves to `pipeline` table after screening
- **Candidate submission drafting** — ✉ button on each kanban card in RoleDetail. Fetches full candidate record, calls AI with JD context. Modal with Email/Bullet format toggle, editable textarea, Save to Queue or Copy. Saved drafts appear in /queue as status: drafted.
- **Bidirectional pipeline movement** — ← and → buttons on every kanban card. ← only appears when there's a previous stage, → only when there's a next. Optimistic UI with rollback on error.
- **Two submission formats** — Email (narrative, under 250 words) and Bullet (structured plain-text bullets, under 150 words). Toggle appears before generation and after — switch format and Regenerate.
- **Submission draft on Candidate Card** — "Draft Submission" button in the page header. Supports JD Specific (pick a pipeline role, pulls its JD) or Generic (candidate record only). Same modal pattern: format toggle, Generate, editable textarea, Save to Queue or Copy.
- **Screener result persistence** — full AI screener output (skills match, red flags, strengths, trajectory) now saves to a standalone `screener_results` table on every run, regardless of whether the candidate is in the pipeline. Pre-pipeline evaluations are no longer lost. If the candidate is in the pipeline for that role, `pipeline.screener_result` is also backfilled. Scores History section on the candidate card now reads from `screener_results` and shows a "Pre-pipeline" badge for evaluations made before the candidate was added to a role.
- **Scorecard result persistence** — full scorecard output saves to `pipeline.scorecard_result` JSONB column on generation.
- **Interaction logging UI** — "Log" button in the Interactions section heading on the candidate card. Inline form with Type (Call / Email / Note), Direction (Inbound / Outbound, hidden for notes), Date (defaults to now), and Notes textarea. Saves to `interactions` table. New entry prepends to the list instantly. Interactions list is now most-recent-first.
- **Stage advance from candidate card** — each pipeline entry row has a "→ [next stage]" button. One click advances the candidate, updates `pipeline.current_stage`, inserts a row into `pipeline_stage_history`, and updates the UI optimistically with rollback on failure. Disables at "placed".
- **Wren Command Bar** — persistent input surface on the Dashboard/Brief page. Accepts paste, file attachment (PDF + DOCX), or any combination. Auto-classifies inputs into labeled chips (Resume, JD, Transcript, Notes) via a fast classify call. Assembles all inputs as labeled `<document>` blocks for the intake prompt. Full intake runs in one pass: candidate + company + role created or matched, screener scored, call signals extracted, interaction logged, pipeline entry created. Save All writes all 7 records to Supabase in sequence. View/Edit links appear inline after save. ✕ Clear button dismisses the result card and resets to input.
- **Recruiter judgment layer** — every pipeline entry on the CandidateCard has an "Add your take" inline form: recruiter score (1–10) + freeform note. Both persist to `pipeline.recruiter_score` and `pipeline.recruiter_note`. Never touched by AI reruns. Recruiter score displays alongside the AI fit score with a distinct purple badge. Same badge visible on kanban cards in RoleDetail. Screener history rows (Scores History) also accept a per-run recruiter note, persisted to `screener_results.recruiter_note`. The delta between AI score and recruiter score is preserved — both visible simultaneously.
- **Edit/Delete everything** — every AI-generated or user-logged record is now deletable inline. Pattern: × button on row hover → "Delete? Yes / Cancel" inline confirm → optimistic delete with rollback on error. Surfaces: screener result rows (Scores History), interaction rows, pipeline entries (CandidateCard), kanban cards (RoleDetail), drafted queue messages. Career timeline: Clear button in section heading → wipes `career_timeline` + `career_signals` from DB. Reparse button replaces "Parse from CV" when timeline exists. Search strings + interview questions: Clear button in section heading. Next action AI card: Regenerate button in card header. WrenCommand IntakeResult: ✕ Clear button in top-right of card.
- **Brief as homepage** — Dashboard replaced AI brief card + stat cards with three structured sections: Activity Digest (since yesterday counts), Needs Attention (overdue/due today/drafts/unscreened/unscheduled), Active Roles (pipeline grouped by role with stage breakdown). No API call on load. Nav reordered: Home | Roles | Candidates | Queue | Clients. Queue defaults to "To Review" tab. CandidateCard header reordered: primary actions first.
- **Multi-screen mode** — WrenCommand auto-detects 1 resume chip + 2+ JD chips and routes to a comparative AI call. Rankings returned as stack-ranked cards (rank, score, recommendation, strengths, gaps, salary_range, next action per role). Graduated recommendations: advance, hold/advance, hold, hold/pass, pass. Save All loops all rankings → client → role → pipeline → screener_result.
- **Per-card pitch generation** — each multi-screen ranking card has a "Generate Pitch" button. Fires two parallel calls and returns both email pitch and bullets simultaneously. Each with Copy and Save to Queue buttons. Save to Candidate persists both formats to enrichment_data. No navigation required.
- **JD text saved from chips** — when a role is created via WrenCommand (single intake or multi-screen), the JD chip's raw text is now saved to `roles.notes`. The Job Description section and Format button appear on RoleDetail for all chip-created roles.
- **Interview guide persistence** — "Save Guide" button in RoleDetail saves generated interview questions to `roles.interview_guide` JSONB column. Guide reloads on every visit. Clear also wipes from DB. Requires: `ALTER TABLE roles ADD COLUMN interview_guide JSONB;`
- **JD format button** — "Format" button in RoleDetail's Job Description section. Runs a cleanup AI pass on raw scraped text (strips HTML artifacts, fixes whitespace), saves back to `role.notes` in place.
- **Unscreened badge** — candidates in the pipeline with no fit score now show a yellow "Unscreened" badge in the Fit column of the Candidates table instead of "—".
- **LinkedIn draft uses recruiter name** — `recruiter.full_name` is now passed to the LinkedIn message prompt. Drafts are personalized to the recruiter, not generic.
- **Promise.allSettled in CandidateCard** — initial data fetch uses `Promise.allSettled`. If screener history, interactions, or roles queries fail, the candidate still loads. Partial data degrades gracefully instead of blocking the whole page.
- **Human writing rules** — applied consistently across all 8 prompt files. No em dashes, en dashes, or dashes as punctuation. No AI cliché vocabulary (leveraged, spearheaded, passionate, etc.). Every prompt now instructs the model to write like a recruiter talking to a colleague.

---

## Database (Supabase)

Key tables:
- `recruiters` — auth user profile
- `candidates` — full candidate record including `cv_text`, `career_timeline` (JSONB), `career_signals` (JSONB), `fit_score`
- `roles` — open positions, linked to clients, includes `jd_text`, `process_steps`
- `pipeline` — candidate × role junction. Tracks `current_stage`, `fit_score`, stage history
- `clients` — companies, with contacts
- `client_contacts` — contacts linked to clients
- `interactions` — permanent record of all touchpoints (writable from candidate card)
- `screener_results` — standalone screener run history per candidate × role, no pipeline dependency
- `messages` — drafted/queued outreach (status: drafted, approved, sent, held)
- `daily_briefs` — morning brief data

---

## Key Components

- `CandidateCard.jsx` — main candidate view. Contains career timeline, screener, signal badges, scores history, next action
- `RoleDetail.jsx` — role view with kanban pipeline board
- `Candidates.jsx` — candidate database table
- `MorningBrief.jsx` — daily brief with stat cards
- `WrenCommand.jsx` — command bar on the brief/dashboard page. Two components: WrenCommand (input surface with chips + textarea + file attach) and IntakeResult (structured output card with score, signals, pitch, bullets, next actions, Save All)
- `ClientDetail.jsx` — client view with contacts
- `api/ai.js` — all Anthropic API calls go through here server-side. Actions: intake, classify, screen, scorecard, submission_draft, career_parse, next_action
- `src/lib/prompts/submissionDraft.js` — prompt builder for submission drafts. Accepts `format` ('email' | 'bullet'). Email = narrative under 250 words. Bullet = structured plain-text under 150 words.
- `src/lib/prompts/intake.js` — prompt builders for intake and classify actions. buildIntakeMessages assembles document blocks + freeform. buildClassifyMessages is fast/minimal, 100 token max.

---

## Edit/Delete Pass (session 7 — 2026-04-15)

Everything Wren generates is now deletable and regeneratable. No new features — all existing data. Changes:
- **CandidateCard** — × delete on screener history rows (deletes from `screener_results`). × delete on interaction rows (deletes from `interactions`). × remove on pipeline entries (deletes from `pipeline`). Career Timeline: "Reparse" + "Clear" buttons when timeline exists; "Clear career data?" inline confirm wipes `career_timeline` + `career_signals`. Next Action AI card: "Regenerate" button in card header.
- **RoleDetail kanban** — × remove button on each candidate card (appears on hover). Inline "Remove? Yes / Cancel" confirm inside the card. Removes from `pipeline` only, candidate record untouched. Search Strings: "Clear" button + inline confirm. Interview Questions: "Clear" button + inline confirm (session-only, no DB).
- **Queue** — "Delete" button on drafted messages only. Inline "Delete this draft? Yes / Cancel" confirm. Removes from `messages` table.
- **WrenCommand IntakeResult** — ✕ Clear button top-right. Dismisses result card, returns to input surface. No confirmation needed (save is permanent; clear is UI-only).
- **CSS** — `.inline-confirm`, `.btn-confirm-yes`, `.btn-confirm-cancel`, `.btn-row-remove`, `.btn-kanban-remove`, `.btn-action--delete` added to index.css.

## Polish Pass (session 6 — 2026-04-15)

Full product polish pass. No new features. Changes:
- **CSS foundations** — Added `.loading-state` + `.spinner` / `.spinner--sm` (standardized across all pages). Added `.empty-state-title` / `.empty-state-body` sub-classes for structured empty states. Added `.page-error` / `.page-error-title` / `.page-error-body` for not-found and fetch failure states. Added `.modal-generating` (spinner + text, replaces italic muted paragraphs in all modal generating phases). Added `.saved-label` (green "Saved ✓" confirmation). Added `@keyframes pulse` + `.stat-value--loading` (animated dash on stat cards while loading). Strengthened `.nav-link--active` from font-weight 500 + #fafafa bg to font-weight 600 + #e4e4e7 bg (much more visible).
- **Dashboard** — Stat card loading is now animated pulse instead of a dash. Brief card empty state copy updated to be actionable. Removed redundant `dashboard-candidates` section (WrenCommand replaces it).
- **Clients / Roles / Candidates / Queue** — All replaced bare `<p className="muted">Loading…</p>` with `.loading-state` spinner. All upgraded empty states to title + body + action structure. All added fetch error state. Roles subtitle copy fixed: "Open positions you are working" → "Active positions in your pipeline". Candidates filtered empty state now has a "Clear filters" button. Queue header aligned to `.roles-header` pattern with message count. Queue empty states are now tab-aware. Queue action errors (approve/hold/send) now surface inline per card.
- **RoleDetail** — Loading and not-found states use standardized patterns. Search strings and interview questions show spinners while generating. All error messages are human-readable. Submission draft modal generating state uses spinner.
- **CandidateCard** — Loading and not-found states use standardized patterns. Next action generating shows spinner in the AI card. All screener/scorecard/pitch/career/modal generating states show spinners. All error states use `.ai-card--error` pattern with human-readable copy. Screener history section always visible (shows empty state instead of hiding). Interactions and pipeline sections have meaningful empty state copy.
- **WrenCommand** — Placeholder copy updated to "Drop anything. Resume, JD, call notes, a question. Wren handles it." Save All confirmation changed from button toggling to a green "Saved ✓" label (button disappears after save). Save error copy changed to "Couldn't save. Try again." Intake processing shows spinner + "Wren is processing…" while running.

---

## Known Bugs / Recent Fixes

- **Fixed (2026-04-14):** Null recruiter guard in CandidateCard.jsx useEffect. Changed `if (!id)` to `if (!id || !recruiter?.id)`. This was preventing career timeline from persisting.
- **Fixed (2026-04-14):** Screener score now fetches pipeline entry fresh before saving to avoid stale state overwrite.
- **Fixed (2026-04-14):** One-click stage advance on kanban — advance button on each candidate card updates stage in Supabase and re-renders column instantly without page navigation.
- **Fixed (2026-04-14):** Screener pipeline fetch changed from `.single()` to `.maybeSingle()` — was returning 406 when candidate not yet in pipeline for the selected role.
- **Fixed (2026-04-14):** Screener results were dropped on page refresh — full result now persists to `screener_results` table regardless of pipeline status.

---

## Product Principles (Non-Negotiable)

**Human first, AI in the middle, human last.**
Wren handles the work between human touchpoints. The recruiter opens their day with a brief, works their roles, and closes with a queue of actions to review. AI fills everything in between.

**Dirty data in, clean intelligence out.**
Recruiters work with incomplete information constantly. A resume with no metrics, a JD scraped from a website, a candidate with a sparse profile. Wren takes whatever it gets and makes it useful. Never refuse to work because data is incomplete. Extract what's there, flag what's missing, move forward.

**The candidate database is the asset.**
Every recruiter's most valuable thing is their network and their history. Wren is where that lives and compounds. Every interaction, every score, every note makes the record richer. The database should feel like it's building itself.

**Enrich over time.**
Nothing in Wren is ever finished. A candidate record gets better every time you touch it. A role gets smarter as you add candidates. A client builds context with every interaction. Design everything to accumulate value, not just store data.

**Speed is respect.**
A recruiter's time is their inventory. Every extra click, every page load, every manual step is a tax on their livelihood. One click to screen. One click to advance a pipeline stage. One click to draft an outreach. If it takes more than one motion it needs to be redesigned.

**Build for the solo recruiter first.**
No team features, no admin panels, no enterprise complexity. The person using Wren is working alone, moving fast, juggling 10 open roles and 50 candidates. Every feature should make that specific person's day easier. If it doesn't serve a solo recruiter in the field it doesn't ship.

**Real use beats perfect design.**
Ryan uses Wren on real Paraform roles with real candidates. Every bug found in real use is more valuable than 10 features built in theory. When something breaks on a real candidate or a real role, fix it before building anything new.

**The screener is only as good as the data.**
Garbage in, garbage out. A candidate with empty cv_text will always score poorly. The most important thing Wren can do is capture complete data on every record. CV extraction, career parsing, interaction notes, call transcripts. Feed the machine.

**Show don't ask.**
Wren should surface what matters without being asked. Signal badges on a candidate card. Fit scores in the candidate list. Next action generated automatically. The recruiter should open a record and immediately know what to do next without hunting for context.

---

## External Review — Standing Constraints (Session 11)

These are not one-time notes. They are standing constraints that apply to every future build decision.

### What's Working — Lock These In

**WrenCommand is the highest-leverage surface.**
Replacing "create candidate / create role / run screener" with "drop anything" was correct product thinking. It is the right intake model. Do not complicate it.

**Everything persists.**
Screener results, recruiter notes, interactions, drafts. This is what makes Wren an OS instead of a tool. Ephemeral AI output is a product antipattern. Wren avoids it. Hold this standard on every new feature.

**One-click is real, not aspirational.**
Stage advance, draft generation, interaction logging. These actually ship as one motion. That is the bar. Hold it.

### Active Constraints

**Risk 1: Feature inventory thinking.**
The product is not "a better ATS." It is a system that reduces cognitive load for a solo recruiter. Every proposed feature must pass this test: does this reduce thinking, or add to it? If it adds to it, cut it or defer it.

**Risk 2: Too many surfaces for v1.**
Current surfaces: CandidateCard, RoleDetail, Queue, WrenCommand, Dashboard, Clients. The risk is fragmentation of attention. The recruiter should never have to think "which screen do I go to?" New surfaces require a strong case.

**Risk 3: AI generates a lot but does not prioritize.**
Wren produces screeners, next actions, drafts, pitches. The real job is surfacing what matters right now. "Needs Attention" and the morning brief are the start of solving this. They must become the core loop, not a feature on the dashboard.

### The Daily Loop (Product North Star)

Everything must serve this loop. If a feature does not plug into it, cut it or hide it.

1. Open Wren — see what matters (not everything)
2. Take action — advance, message, log
3. Close — queue is clean

Every surface, every AI call, every UI decision should make this loop faster and lower-friction. This is the test.

### Before Proposing or Building Anything New

Ask all four:
- Does it serve the daily loop?
- Does it reduce cognitive load or add to it?
- Does it compound toward the autonomous OS vision?
- Can it be done in one motion?

If the answer to any of these is no, redesign or defer.

---

## Wren v1 — The Perfect Daily Workflow (Behavioral Spec)

This is the target experience. Every build decision should make this workflow faster, cleaner, and lower-friction.

### 7:45am — Ryan opens Wren

He lands on the Brief. Not a dashboard. Not a feed. A brief.

The page answers three questions immediately, no scrolling:

**What happened since yesterday?**
New candidates processed. Stages advanced. Responses received. Screeners run. Shown as a tight activity digest, 5 lines max.

**What needs attention right now?**
Candidates who went cold. Roles with no movement in 5+ days. Pipeline entries sitting unscreened. Drafts waiting in queue. Each item is a link. One click takes him directly to the thing that needs action.

**What does today look like?**
Roles with active candidates. Next actions queued. Anything time-sensitive flagged at the top.

He does not hunt. He reads, clicks, works. Total time on the Brief: 90 seconds.

### 8:00am — He works his roles

He clicks into a role from the Brief. Lands on the kanban. The board shows where every candidate stands. Fit score visible on every card. Recruiter score where he has added one. Unscreened badge where he has not.

He sees a candidate he forgot about. Clicks the card. CandidateCard opens. Wren has already generated a next action. He clicks "Draft Submission." Modal opens. Pre-filled. He edits one sentence. Saves to Queue.

Total time on this candidate: 4 minutes.

He advances two other candidates with single arrow clicks. No page loads. No confirmation dialogs.

### 9:30am — New resume lands in his inbox

He copies the text. Opens Wren. Drops it into WrenCommand along with the JD URL. Wren classifies, runs intake, returns candidate record, fit score, signals, red flags, next action, submission draft in both formats. He clicks Save All. Done.

Total time: 3 minutes.

### 11:00am — Client call

He checks the client record before dialing. Last interaction, open roles, candidates in flight. He makes the call. Takes rough notes in the interaction log while talking. Saves on hang-up.

### 2:00pm — Candidate calls him back

He logs the interaction. Adds his recruiter score: 8. Note: "Strong communicator. More senior than the resume reads." AI had scored this candidate a 6. The delta is now visible. Wren stores it. Ryan moves on.

### 4:30pm — End of day

He opens the Queue. Three drafted submissions waiting. He reads each one. Edits one. Approves all three. Pastes them into Paraform or emails them directly. One copy action per submission. Queue is clean. He closes Wren.

### What Wren Did Today (Invisible Work)

Ryan made the calls. Ryan built the relationships. Ryan made the judgment calls. Wren did everything in between: classified and parsed two new resumes, scored four candidates against three roles, generated three submission drafts, logged five interactions, surfaced two "needs attention" items he would have missed, updated six pipeline records, kept the candidate database current without a single manual data entry.

That is the product. Not features. That workflow.

**The Brief is the start. The Queue is the end. Everything in between is the middle that Wren owns.**

### Build Test for This Workflow

- Where does this live in the daily loop?
- Does it make one of these steps faster?
- Does it reduce a decision Ryan has to make?
- Can it be done without navigating away from where he already is?

If a feature does not show up in this workflow, it either belongs in the background (invisible Wren work) or it does not ship yet.

---

## Current Priority Queue

_Session 11 audit complete and executed. All 4 priorities shipped._

### Completed session 11b

**Priority 1 — Brief overhaul (shipped)**
- Removed AI brief card and stat cards from Dashboard
- Added `ActivityDigest` component: counts since yesterday (new candidates, stage advances, screeners run, interactions logged). Pure DB count queries, no API call.
- Enhanced `NeedsAttention` (was TodayActions): added 5th query for unscreened pipeline entries (fit_score IS NULL, not placed). Deduplication prevents same candidate appearing twice.
- Added `TodayPipeline` component: groups active pipeline by role, shows candidate count and stage breakdown. Each row links directly to the role's kanban.
- Page structure: Greeting → Since Yesterday → Needs Attention → Active Roles → WrenCommand

**Priority 2 — Speed audit (shipped)**
- Added `--color-primary: #18181b` to CSS root (was undefined, caused silent rendering bugs in queue dot and action label colors)
- Removed AI brief generation on page load (was firing an Anthropic API call every 4 hours; page now loads purely from DB queries)
- All async states confirmed: spinners on all three new sections

**Priority 3 — Surface audit (shipped)**
- Nav reordered: Home | Roles | Candidates | Queue | Clients. Clients de-emphasized to last position.
- Queue default tab changed from 'all' to 'drafted'. Opens to "To Review" — the actionable state.
- CandidateCard header reordered: Draft Submission | Next Action (primary) | Outreach | LinkedIn | Edit | Call Mode | Delete. High-frequency actions first.

**Priority 4 — Recruiter vs. AI delta**
No code. Data is preserved. Build path is clear.

---

### Priority 1 — Brief overhaul: make it the real homepage (not a dashboard)

The Brief must answer three questions without scrolling, in under 90 seconds:
1. Activity digest — what happened since yesterday (5 lines max): new candidates processed, stages advanced, screeners run, responses received
2. Needs Attention — who is at risk, who is hot, what is stalled, what is unscreened, drafts waiting. Every item is a clickable link directly to the thing. No hunting.
3. Today's view — roles with active candidates, next actions queued, time-sensitive items flagged at top

This replaces the current stat-card dashboard pattern as the mental model. The Brief is where Ryan starts and where the day is organized.

### Priority 2 — Speed audit: enforce "speed is respect" as a hard standard

Apply to every surface before adding anything new:
- Every async state has a spinner or skeleton (no blank areas while loading)
- Every action has instant feedback (optimistic update or spinner within 100ms)
- Zero dead clicks (no buttons that do nothing, no nav that doesn't go somewhere useful)
- No confirmation dialogs on low-stakes actions (advance stage, add to pipeline, log interaction)

### Priority 3 — Surface audit: kill dead weight

Audit each surface against the daily workflow spec:
- **Queue** — does Ryan open it daily? If not, is it findable from the Brief (end-of-day close)? Simplify to match the "4:30pm" workflow step.
- **Clients page** — is it part of the core loop? If it is only used pre-call, collapse it or make it accessible from the Brief or role context. Do not give it nav weight it has not earned.
- **CandidateCard** — density audit. Is every section visible on first load justified? Candidates Ryan has not touched in 7+ days should not demand the same visual weight as hot candidates.
- **Nav order** — currently: Brief, Clients, Roles, Candidates, Queue. Evaluate whether Clients belongs between Brief and Roles or whether it should be lower.

### Priority 4 — Recruiter vs. AI delta (do not build yet, do not block)

The data is already stored: `pipeline.recruiter_score` vs `pipeline.fit_score`. The next step is surfacing patterns. Do not build this now. But do not build anything that makes it harder to build later. When the time comes: "You have rated backend engineers consistently higher than AI" or "You passed on 5 candidates AI scored 8+."

---

_Completed session 10:_ Multi-screen prompt quality (named resume items, graduated recs, salary range), per-card pitch with both email+bullets, next action setter on pipeline entries, role close/reopen, queue Copy & Send, DB-level candidate search, pitch save to candidate from multi-screen, next action recruiter override, always-on "Needs Attention" dashboard section, brief renamed from "Morning Brief" to "Wren", 4-hour localStorage cache, revenue-first brief prompt.

_Completed session 9:_ Multi-screen mode, inline submission draft from multi-screen, JD text saved from chips, interview guide persistence, JD format button, unscreened badge, LinkedIn recruiter name, Promise.allSettled in CandidateCard, human writing rules across all prompts. Call mode, mobile CSS, Google Doc URL chip, pitch save, duplicate pipeline error, stage advance desync.

_Completed session 8:_ Recruiter judgment layer — pipeline score + note, screener result note. AI score and recruiter score coexist, neither overwrites the other.

_Completed session 7:_ Edit/delete everything — inline confirm pattern across all generated content. Screener results, interactions, pipeline entries, kanban cards, drafted messages, career timeline, search strings, interview questions, next action regenerate, WrenCommand clear.

_Completed session 6:_ Full product polish pass — spinner system, empty/error/loading states, nav active treatment, WrenCommand UX hardening. No new features.

---

## Decisions Log

- **Recruiter score and AI score are separate, permanent tracks.** `pipeline.recruiter_score` and `pipeline.recruiter_note` are never touched by AI reruns. The AI generates its read; the recruiter layers theirs on top. Both visible. The delta between them is meaningful data — if a recruiter consistently rates higher than the AI, that's a calibration signal worth surfacing eventually.
- **Inline confirm is the delete pattern.** No modals for destructive actions. One click surfaces "Delete? Yes / Cancel" inline in the row/card. Yes triggers the delete, Cancel dismisses. Error shown inline if delete fails. This is the standard for all future delete actions.
- **× button appears on hover.** Row remove buttons (`.btn-row-remove`, `.btn-kanban-remove`) are opacity 0 by default, opacity 1 on parent hover. This keeps the UI clean without sacrificing discoverability.
- **Regenerate vs. Clear distinction.** Regenerate = overwrite in place, no confirmation. Clear = wipe from DB, requires confirm. Both available when AI-generated data exists.
- **Polish before features.** Session 6 was a full product polish pass — no new features. Established that the product needs to feel intentional before adding surface area. Patterns established: `.loading-state` + `.spinner`, `.empty-state-title/.body`, `.page-error`, `.modal-generating`. All future pages and features should use these from the start.
- **Save All confirmation pattern.** After a successful save in WrenCommand (and all future save-and-done flows), the action button is replaced by a static "Saved ✓" label. Buttons do not toggle back to their original state after save — the save is permanent, the confirmation is final.

- **AI calls are server-side only.** All Anthropic API calls go through api/ai.js. Key never touches the client. Non-negotiable.
- **JSONB for flexible data.** Career timeline, career signals, and process steps use JSONB columns so structure can evolve without migrations.
- **One-click as the design bar.** Any action that takes more than one motion gets flagged for redesign.
- **No LinkedIn API.** Too locked down. LinkedIn strategy is: (1) draft outreach inside Wren, copy/paste to send, (2) accept manual profile paste as a CV input source, (3) Chrome extension is the right v2 play for frictionless candidate capture from LinkedIn profiles.
- **Paraform is the primary submission channel.** Wren needs to make submissions faster and more compelling than what a tired recruiter writes at 4pm.
- **Document block pattern for multi-input AI calls.** When sending multiple inputs to the model (resume + JD + transcript), each is wrapped as a labeled `<document>` block with type and name attributes. This gives the model clean context boundaries and is the standard pattern for all future multi-input features.
- **Classify call is intentionally minimal.** 100 token max, 2000 char input slice, no schema. Speed is the priority. Fallback to { type: 'notes', label: 'Document' } rather than erroring. Never block the UI waiting on classification.

---

## How to Start a Session

In Claude Code:
```
read WREN.md
```
Then state what you're building. Claude will have full context and can proceed without re-briefing.

After each session, update the following sections in this file:
- What's Built and Working (if something new shipped)
- Known Bugs / Recent Fixes (if something was fixed)
- Current Priority Queue (reorder or check off completed items)
- Decisions Log (if a new architectural or product decision was made)
