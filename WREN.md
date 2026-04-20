# WREN — Standing Context
> Read this at the start of every Claude Code session. Session history lives in CHANGELOG.md.

---

## V3 Product Framing

**Wren is the deal desk for solo recruiters.**

It pressure-tests candidates, runs closes, and surfaces signals and risk. At every decision point in a live deal — intake, screen, submission, follow-up, debrief, offer — Wren tells the recruiter what the situation is and what to do next.

Not an OS. Not a co-pilot. Not a chatbot. A deal desk agent with recruiter logic.

The questions Wren answers:
- Is this candidate closeable?
- What are the gaps — motivation, comp, competing offers, hiring manager readiness?
- What's the next move to advance or protect this deal?
- Where is this deal at risk?

Every build decision should advance one of these four questions.

---

## The thesis

**Wren turns candidates into placements.**

You know how to source. Your Sales Navigator, your network, your referrals — that's your craft. Wren starts the moment you have a candidate. Paste a URL, a resume, ugly LinkedIn copy — any of it works. From there, Wren handles everything between "I found them" and "they signed the offer": screening, pitching, submissions, outreach, follow-ups, replies, interview prep, debriefs, re-engagement.

Sourcing is the *visible* part of the job. Closing is the *real* one. Competitors pitch on the top of the funnel. Wren owns the bottom — the part where the money lives, where relationships deepen, and where every existing tool fails to help.

The moat is the memory. Every interaction, submission, objection, and debrief gets captured and compounds. A recruiter with six months in Wren has a system that knows their book of business. Sourcing tools are replaceable. That is not.

Every build decision defends that thesis. If a feature doesn't help turn a candidate into a placement, it doesn't ship.

---

## What Wren is

Wren is an agent that works the desk of a solo independent recruiter.

It screens candidates, drafts submissions, flags what needs attention, and keeps the database current while the recruiter is on a call, with a client, or away from the desk. The recruiter opens the day with a brief, works their roles, closes with a queue of actions to review. The agent fills everything in between.

Not an OS. Not a co-pilot. Not a chatbot. An agent with recruiter logic and a platform to execute and store it.

**Two layers:**
- **The agent** — recruiter logic encoded as prompt skills. Fires on events. Works without being asked.
- **The platform** — stores every candidate, role, interaction, score, and signal so the agent compounds over time.

The agent is useless without the platform. The platform is just an ATS without the agent.

---

## The shift that defines the roadmap

**Today:** Most skills fire on button press. Three are event-driven (see below).
**Next:** More skills migrate to event triggers as real-use patterns confirm the right firing conditions.
**Later:** Wren works overnight. Screens incoming resumes. Drafts submissions. Queues follow-ups. Surfaces what needs action tomorrow.

Every feature should move one step toward the later version. The test on every build: *did Wren get more autonomous this session, or just prettier?*

**Event-driven today (fire without a button press):**
- Auto-screen when a candidate is added to a role (fires on pipeline insert)
- Auto-regenerate next action when stage advances (fires on stage change)
- Auto-generate search strings when a role is created (fires on role create)

**Button-driven today (candidates for future event migration):**
- Resume screener, scorecard, pitch builder, submission draft, outreach, interview questions, intake — all triggered manually. Migration path: identify the event that makes each one useful (e.g., submission draft fires when stage advances to "Shortlisted").

---

## Non-negotiable principles

**Human first, AI in the middle, human last.** Recruiter sets direction. Wren executes. Recruiter approves and delivers. The middle is Wren's job and it keeps expanding.

**The agent fires on events, not buttons.** Every skill currently behind a button press is a candidate for event-based automation. The question is always: what event triggers this?

**Dirty data in, clean intelligence out.** Never refuse because data is incomplete. Extract what exists. Flag what's missing. Move forward.

**The candidate database is the asset.** Every interaction, score, and note makes the record richer. A recruiter with six months of data in Wren does not switch.

**Enrich over time.** Nothing is ever finished. A candidate record gets better every time it's touched.

**Speed is respect.** A recruiter's time is their inventory. One click. One motion. If it takes more than one motion, redesign.

**Solo recruiter first.** No team features. No admin panels. No enterprise complexity. One person, alone, moving fast, juggling 10 roles and 50 candidates.

**Real use beats perfect design.** Bugs found in real use are worth more than features built in theory.

**Show don't ask.** Surface what matters without being asked. The recruiter opens a record and knows the next move without hunting for context.

**Channel-agnostic.** Wren drafts. The recruiter delivers. Never build for a specific submission platform.

**Everything persists.** Ephemeral AI output is an antipattern. Every skill result, score, note, and draft is stored.

---

## Core loop

**The Brief → work the roles → The Queue.**

The Brief answers three questions without scrolling: what happened since yesterday, what needs attention now, what does today look like. 90 seconds to read.

In the middle, the recruiter works candidates and roles. Single-click advance. Single-click draft. Sticky context bar so the next move is always visible.

The Queue is the end of the day. Submission drafts waiting. Follow-ups ready. Read, edit, approve, copy, send. Inbox-clear feel.

Everything outside this loop needs a strong case.

---

## The skill layer (the brain)

Wren's intelligence lives in `src/lib/prompts/`. These are not features. They are skills. The platform gives them context, memory, and a place to execute.

| Skill | File |
|---|---|
| Resume Screener | `resumeScreener.js` |
| Candidate Pitch Builder | `candidatePitchBuilder.js` |
| Outreach Email | `candidateOutreachEmail.js` |
| LinkedIn Message | `linkedinMessageGenerator.js` |
| Interview Questions | `interviewQuestionGenerator.js` |
| Boolean Search Builder | `booleanSearchBuilder.js` |
| Evaluation Scorecard | `candidateScorecard.js` |
| Job Description Writer | `jobDescriptionWriter.js` |
| Intake | `intake.js` |
| Submission Draft | `submissionDraft.js` |
| Career Timeline Parser | `careerTimeline.js` |
| Next Action | `nextAction.js` |
| Daily Brief | `dailyBrief.js` |
| Multi-Screen | `multiScreen.js` |
| JD Extractor | `jdExtractor.js` |
| CV Extraction | `cvExtraction.js` |

The skills are the moat. Anyone building a competing product has to hire the same recruiters and extract the same logic. Protect them. Extend them. Never dilute them.

---

## Channel philosophy

Wren is channel-agnostic. It drafts. The recruiter delivers.

**Client submissions** are candidate pitches sent to hiring managers. The channel (email, ATS, submission portal, LinkedIn message) is the recruiter's choice. Wren's job is to make the pitch better than what a tired recruiter writes at 4pm.

**Outreach** is drafted inside Wren, copied and sent by the recruiter. LinkedIn has no API and blocks automation. Chrome extension is v2.

**Email** is the most automatable channel. Drafting works today. Gmail integration is a future milestone.

---

## Stack

| Layer | Tool |
|---|---|
| Frontend | React + Vite |
| Database + Auth | Supabase |
| Hosting | Vercel |
| AI | Anthropic API — `claude-sonnet-4-6` |
| Serverless | `api/ai.js` (Vercel functions) |

- Repo: github.com/primertalent/primer
- Live: primer-rosy-two.vercel.app
- Local: `C:/Users/Ryan McGuinness/primer`
- Run: `cd ~/primer && claude`
- Dev server: `http://localhost:5173`

**AI calls are server-side only.** All Anthropic calls route through `api/ai.js`. The API key never touches the client. Non-negotiable.

---

## Data model (Supabase)

Active tables — all read and written by current code:

| Table | Purpose |
|---|---|
| `recruiters` | auth user profile |
| `candidates` | full record: `cv_text`, `career_timeline` (JSONB), `career_signals` (JSONB), `enrichment_data` (JSONB) |
| `roles` | open positions: `notes` (JD), `process_steps` (JSONB) |
| `clients` | companies with contacts |
| `client_contacts` | contacts linked to clients |
| `pipeline` | candidate × role: `current_stage`, `fit_score`, `fit_score_rationale`, `recruiter_score`, `recruiter_note`, `scorecard_result` (JSONB), `screener_result` (JSONB), `next_action`, `next_action_due_at`, `submitted_at`, `last_followup_at` |
| `pipeline_stage_history` | every stage movement |
| `interactions` | every touchpoint (call, email, note, meeting) |
| `screener_results` | standalone screener history, no pipeline dependency |
| `messages` | drafted / approved / sent / held outreach |
| `debriefs` | post-interaction signal capture: `outcome`, `feedback_raw`, `summary`, `motivation_signals`, `competitive_signals`, `risk_flags`, `positive_signals`, `hiring_manager_signals`, `next_action`, `questions_to_ask_next`, `updates_to_record` (all JSONB signals) |

**JSONB where structure will evolve.** Career timeline, signals, process steps, screener results, scorecard results. No migrations needed when the shape changes.

**Row-level security on every table.** Scoped to `current_recruiter_id()`. Helper lives in the initial schema.

---

## Key components

| Component | Role |
|---|---|
| `Dashboard.jsx` | Deal desk home: WrenCommand (Zone 3), Pipeline Value (Zone 1), The Desk (Zone 2). |
| `WrenCommand.jsx` | Command bar. Paste / file / URL → chips → auto-save intake or multi-screen result. Resume auto-parses on drop. File dedup by name+size. |
| `WrenResponse.jsx` | Sticky bottom agent response bar. Shows after every action: thinking animation → message + suggestion chips. |
| `AgentContext.jsx` | Global agent state. `fireResponse(action, context)` fires agentResponse prompt. `dispatch(actionId, context)` routes chip actions via page registry then navigation fallback. `registerAction` / `unregisterAction` for page-level handlers. |
| `CandidateCard.jsx` | Candidate deal view. Deal Status Bar (sticky, replaces old context bar) + three-zone action panel + single-column scroll. Registers `log_debrief`, `log_interaction`, `set_expected_comp` action handlers. |
| `RoleDetail.jsx` | Role view with kanban, search strings, interview questions, JD. |
| `Queue.jsx` | End-of-day inbox. Drafts, approved, sent, held. |
| `Candidates.jsx` | Network search. Find past candidates by stage, signal, skill, fit score, recency. Deal history, not inventory. |
| `api/ai.js` | Server-side Anthropic passthrough. |
| `src/lib/prompts/` | Every skill. |

---

## Build rules

**Before any feature, run this check:**
- Does it serve the core loop (Brief → work → Queue)?
- Does it fire on an event or require a button press? (Event is better.)
- Can it be done in one motion?
- Does it compound toward the autonomous agent?
- Is it channel-agnostic?

If any answer is wrong, redesign or defer.

**Standing constraints:**
- WrenCommand is the highest-leverage surface. Do not complicate it.
- Everything persists. Ephemeral AI output is an antipattern.
- One-click is the bar. More than one motion gets flagged for redesign.
- New surfaces need a strong case. Too many surfaces is a risk.
- The Brief and Needs Attention are the prioritization layer. That is the core loop, not a dashboard feature.
- Recruiter score and AI score are separate permanent tracks. Don't collapse them.

---

## Current state

**What's built and working:**
- Conversational agent layer: WrenResponse sticky bottom bar speaks back after every action. Message + 1-3 suggestion chips. Thinking/speaking/error states with personality text rotation.
- WrenCommand: paste/upload/URL → auto-saves intake/multi-screen → WrenResponse confirms. No Save All button. Resume auto-parses on drop (single resume, no result showing). File dedup by name+size.
- Dashboard: Deal desk home (Zone 3 WrenCommand, Zone 1 Pipeline Value, Zone 2 The Desk)
  - Pipeline Value: primary total + probability-weighted, stage probabilities interviewing=0.25/offer=0.75/placed=1.00
  - The Desk: urgency-sorted deal rows (overdue → today → active/stale) with risk pills
- CandidateCard: refactored as a live deal view (not a record view)
  - **Deal Status Bar** (sticky top): candidate name + current role/company | role link | stage + days-in-stage | AI score / recruiter score (color-coded) | risk pills (Comp gap, Counter offer risk, Thin motivation, Slow HM, Stalled) | next action | expected comp or "Set comp" chip. For off-pipeline candidates: last touch + signal badges + "Add to a role" chip. Counter offer risk derives from `debrief.motivation_signals`, `competitive_signals`, `risk_flags` (keywords: underpaid, comp gap, passive, below market) + `career_signals` Long Tenure flag.
  - **Card hierarchy**: Deal Status Bar → Latest debrief summary card → Debrief signals panel → Zone A/B/C actions → Interactions log (3 visible, show more) → Pipeline (collapsed) → Resume & timeline (collapsed) → All debriefs (collapsed) → Career signals (collapsed) → Screener results (collapsed) → Details & edit (collapsed)
  - **Zone A "Work this deal"**: max 3 contextual primary actions via state-based rules (stage + last interaction + debrief status). Stage-specific: log interaction, log debrief, screen vs role, prep interview, lock comp, prep counter offer. Call-prep stubs for interview/offer actions (Wednesday build replaces stubs).
  - **Zone B "Generate"**: draft submission, outreach, LinkedIn, pitch, interview questions. Pitch + IQ results render inline below Zone B.
  - **Zone C "More"**: overflow popover — Call Mode, Edit candidate, Remove from pipeline, Mark as placed.
  - Interaction editing: click any interaction row → edit modal for type + notes. Preserves `debrief_id` link on save. "Debrief linked" notice shown.
  - Resume auto-parses on card load if `cv_text` exists but `career_timeline` is null (no button press needed).
  - Expected comp blocking modal on stage advance to interviewing/offer/placed when expected_comp is null
- RoleDetail: kanban pipeline + interview questions + search strings + JD
- Queue: drafted / approved / sent / held outreach
- Candidates: network search by stage, signal, skill, fit score, recency
- Event triggers: auto-screen on pipeline add, auto-next-action on stage advance, auto-search-strings on role create, auto-debrief prompt on call/meeting log
- Recruiter score + AI score as separate permanent tracks on every pipeline entry
- Debrief capture: paste transcript or brain dump → extract structured signal (motivation, competitive, risk, positive, HM signals, next action, questions to ask, record updates) → save to debriefs table → surface on sticky context bar and debrief signals section
- Placement fee fields on roles (% of comp or flat fee, defaults from recruiter profile)
- Schema: `roles.placement_fee_pct`, `roles.placement_fee_flat`, `pipeline.expected_comp`, `recruiters.default_placement_fee_pct`

**What's been cut:**
- Wren.jsx (chat page) — removed. Contradicted "agent, not chatbot" repositioning. `/api/wren` was a stub.
- Clients.jsx / ClientDetail.jsx — removed. OS-pattern surfaces. Client context lives in RoleDetail.
- Dashboard ActivityDigest / NeedsAttention / TodayPipeline — replaced by deal desk zones.
- Daily Brief skill — removed. Redundant with Dashboard.
- Boolean Search skill — removed. Sourcing tool, not deal desk.

**V3 priority queue (do not build this session — queued for future):**
- Role activation scans candidate database for existing fits
- Deal scorecard per candidate in pipeline (closeability: motivation, comp alignment, competing offers, HM readiness)
- Close sequence generator by stage (what needs to happen to get from here to offer)
- **Call Prep module** (Wednesday build): one module, used across every "pick up the phone" moment. Zone A stubs for "Prep for next interview", "Lock comp expectations", "Prep for counter offer" will route here.

**What's next (current priorities):**
- Time-elapsed triggers via Supabase Edge Functions on a schedule
- Auto-set `next_action_due_at` when next action fires
- Wire "Draft Follow-Up" on Needs Attention to actually draft

**Do not build:**
- Team features, shared pipelines, assignments
- Chrome extension (v2)
- Gmail integration (v2)
- New analytics or reporting surfaces
- Any second recruiter's feature requests

---

## Decisions log

Architectural and product decisions that stand. Behavior here overrides intuition.

- **Wren is an agent with a platform, not an OS.** The OS framing was technically accurate but wrong as a product concept. The agent is useless without the platform. The platform is just an ATS without the agent.
- **Client submission, not Paraform submission.** Wren drafts the pitch. The recruiter chooses how to deliver it. Never build for a specific platform.
- **Skills fire on events, not buttons.** Every skill behind a button press is a candidate for event-based automation.
- **The skill prompts are the brain.** Built on recruiter logic from real recruiters. This is the moat.
- **Recruiter score and AI score are separate permanent tracks.** `pipeline.recruiter_score` and `pipeline.recruiter_note` are never touched by AI reruns. Both visible. Delta is calibration data.
- **Inline confirm is the delete pattern.** No modals. One click surfaces Yes / Cancel inline.
- **× button appears on hover.** Clean UI without sacrificing discoverability.
- **Regenerate vs. Clear.** Regenerate = overwrite in place, no confirm. Clear = wipe from DB, requires confirm.
- **Save All confirmation.** After successful save, action button replaced by static "Saved ✓" label.
- **AI calls are server-side only.** All Anthropic calls go through `api/ai.js`. Non-negotiable.
- **JSONB for flexible data.** Career timeline, signals, process steps, screener results, scorecard results, interview guide.
- **Agent response fires after save, not during.** Save must commit before agentResponse is called. If agentResponse fails, save is already committed. WrenResponse renders error state: "Saved. Wren hit a branch generating next steps." User never loses data due to agent failure.
- **WrenResponse renders in AppLayout as fixed bottom bar.** Lives above routes, persists across navigation. Thinking state sets before navigate; response fills in on the next page.
- **Action dispatcher: page registry first, navigation fallback second.** Pages register handlers via `registerAction(actionId, fn)` on mount. `dispatch` checks registry before navigating. CandidateCard registers log_debrief, log_interaction, set_expected_comp.
- **Pushback is honest observation, not blocking.** Action completes first. One pushback max per response. ~30-40% frequency. Never stacked.
- **agentResponse voice rules.** 1-2 sentences. No em dashes. No "I have completed." Bird metaphors max every 4-5 responses. Banned verbs: tweet, fly, feather, nest, wings, egg, flutter, chirp. Never "you should" or "you need to."
- **Save All removed from WrenCommand intake flow only.** CreateCandidate and CreateRole forms keep their submit buttons. Auto-save fires on IntakeResult/MultiScreenResult mount.
- **Resume auto-parse: fires on drop only when no result is showing.** Single resume chip, no JD chips, no freeform text. Dedup: same name+size returns cached chip content, no re-fire.
- **Pipeline value formula.** `placement_fee_flat` takes precedence. If null, `expected_comp * placement_fee_pct`. Stage probabilities: interviewing=0.25, offer=0.75, placed=1.00. Weighted = sum(fee * prob) across active entries in those stages.
- **Expected comp is required for interview+ stages.** Blocking modal fires on stage advance to interviewing/offer/placed when `pipeline.expected_comp` is null. Soft prompt surfaces on load for existing entries missing comp.
- **Placement fee defaults from recruiter profile.** `recruiters.default_placement_fee_pct` auto-fills `placement_fee_pct` on new role creation.
- **No LinkedIn API.** Too locked down. Draft in Wren, copy to send.
- **Document block pattern for multi-input AI calls.** Multiple inputs wrapped as labeled `<document>` blocks with type and name. Standard for all multi-input features.
- **Classify calls are intentionally minimal.** 100 token max, 2000 char input slice. Speed over completeness. Never block the UI waiting on classification.
- **Role matching is semantic, not string.** Intake prompt receives all existing open roles. Model matches by meaning. `role_id` in the result means match was found — use it directly, skip DB lookup.
- **Single column beats multi-column for dense content.** If content length is unpredictable, don't put it in a fixed-width column.
- **Event-based triggers ship first. Time-elapsed triggers later.** Event triggers fire synchronously off user actions, no new infra. Time-elapsed triggers need scheduled jobs (Supabase Edge Functions or cron). Don't build time-elapsed until event triggers are proven in real use.
- **Full prompt lives in `src/lib/prompts/`.** `api/ai.js` is a passthrough only. No prompts hardcoded server-side. Single source of truth.
- **CandidateCard is a deal view, not an ATS record.** Top-to-bottom order: what is this deal, what's at risk, what do I do next. Reference material (resume, full debrief list, career signals) lives collapsed below the fold.
- **Zone A actions are state-based rules, not a prompt call.** Stage + last-interaction age + debrief-on-latest-interaction determines which 3 actions surface. Fast and deterministic. No API call on card load.
- **Risk pills derive from debrief JSONB, not new capture.** `motivation_signals`, `competitive_signals`, `risk_flags` text is scanned for keywords at render time. Counter offer risk also fires on `career_signals` Long Tenure when passive indicators are present.
- **Interaction editing preserves debrief link.** Edit modal patches `type` and `body` only. `debrief_id` is never touched. "Debrief linked" note shown in modal.
- **Resume auto-parses on card load if cv_text exists but no career_timeline.** One-shot via ref guard — fires once per card load, not on every render.
- **Call Prep module is a stub in Zone A.** "Prep for next interview", "Lock comp expectations", "Prep for counter offer" show a stub message until the Wednesday build replaces them.
- **Zone B pitch and interview questions render inline below Zone B.** No separate modal needed for results. Copy button available. Dismiss button clears result.

---

## How to start a session

In Claude Code:
```
read WREN.md
```

If an `AUDIT.md` is present in the repo root, read that too — it's a session brief with specific work to do.

State what you're building. Full context, no re-briefing needed.

**After each session:**
- Update **Current state** if a new capability shipped or priorities shifted
- Add new architectural decisions to **Decisions log**
- Log the session in `CHANGELOG.md`

---

## Knowledge Base / V2 Feature Concepts

Sourced from practitioner posts and conversations. These inform future builds but are not V1 scope unless noted.

**BD INTELLIGENCE LAYER (Deal Desk V2):**
- MPC marketing: one-click generation of most placeable candidate pitches to target client list
- Job-opening approach: match open roles (client records or scraped JDs) against candidate database, surface pitch suggestions
- BD signal extraction from candidate calls: capture "where else are you interviewing," "through a recruiter or direct," "who did you speak with," "what triggered the hire"
- Company record auto-creation when candidates name hiring companies
- Pre-call prep briefs: "I know / I heard / I saw" intelligence before BD calls

**NETWORK INTELLIGENCE (V2):**
- Network check-in queue: randomly surface contacts not touched in 30/60/90 days with a human check-in message
- Last contacted aging on every record, visible as a signal
- Warm over cold: Wren biases suggestions toward existing network first

**ROLE QUALITY SCORING (V2):**
- Score roles at intake on fee potential, fill probability, exclusivity, HM access, process clarity
- Surface role health score in pipeline view
- "What problem is this hire meant to solve?" as anchor question at role intake

**GOOD CLIENT SCORING (V2):**
Five binary criteria per client record:
- Fee at or above 20%, no refund
- 2+ of the same req open
- Interview cadence active (one in last 7 days, one scheduled next 7)
- 3 or fewer interview stages, offers through recruiter
- Phone reachable within 24 hours

Wren scores 0–5. 5/5 = Good Client. Visible on client record and daily brief.

**BD VS RECRUIT DIRECTIVE (V2):**
Daily brief opens with BD vs recruit guidance based on reqs and Good Client count. Removes guesswork.
- Weekly formula: 0–5 reqs BD daily, 6–10 BD 3 days, 11–15 BD 1 day, 16+ pure recruit
- Daily formula (split-desk): 5+ Good Clients = no BD. Full-desk: 3+ Good Clients = no BD.

**RISK AND QUALIFYING SIGNALS:**
- Counter-offer risk (expand V1 logic with tenure + comp delta + reasons for leaving)
- Role stall patterns: submittals without interviews, slow feedback, rescheduling
- Time in stage triggers for disqualification

**DAILY DISCIPLINE:**
- BD activity counter: 10 suggested touches a day, ranked by conversion likelihood

**DEFERRED THIS SESSION:**
- Role page redesign (next session)
- Network page sorting (separate cleanup)
- Fit score vs tier debate (product decision, not a build)
- Off topic fallback (backlog)
- Call Prep module full build (Wednesday session)
- Any V2 feature from the Knowledge Base section
