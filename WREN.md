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

## ICP

Primary user: the solo independent recruiter running on LinkedIn Recruiter, spreadsheets, email, and maybe Paraform. No ATS. No coordinator. No team. 5 to 20+ years of recruiting experience. Billing $150k to $1M+ annually, entirely on their own effort.

**Already a competent closer.** Wren scales their existing motion, doesn't replace skill they don't have. The pitch is leverage, not coaching. "You're already good at this. Wren lets you do it ten times instead of three." Bad closers buying Wren as a skill upgrade churn at 60 days because volume doesn't fix the underlying gap. Good closers buying Wren as leverage stay because the floor under their off days and the multiplier on their best days both compound.

This user is underserved by every existing tool. Enterprise ATSes (Bullhorn, Greenhouse, Ashby) are too heavy. Modern ATSes (Crelate, Recruiterflow, Loxo) still require setup, training, data migration. Sourcing tools (Gem, HireEZ) solve the wrong problem. AI recruiting startups target in-house TA teams.

Wren meets them where they are. Paste a resume, paste a JD, paste call notes. Wren does the deal desk work the recruiter doesn't have time for. No migration, no integration, no setup.

Secondary users eventually: small boutiques (2–3 recruiters), recruiters inside Paraform's network, agency recruiters frustrated by their firm's ATS. Not the focus now.

Not the user: in-house TA teams, corporate recruiters, high-volume sourcing shops, anyone whose primary job is req management rather than closing.

---

## Wren is not an ATS

An ATS stores data. Wren uses data to run the deal. Wren coexists with whatever system of record a recruiter already uses, or with no system at all. The intelligence layer is what Wren owns.

Design principle: Wren's architecture should not assume it is the system of record. Candidates, roles, and clients get `external_id` (nullable) and `source` fields. Wren-native records get `source = 'wren'`. Future imports or integrations get their own source tags. Intelligence layer data (debriefs, signals, agent actions, pipeline value calculations) stays separate from source records.

---

## The thesis

**Wren turns candidates into placements.**

You know how to source. Your Sales Navigator, your network, your referrals — that's your craft. Wren starts the moment you have a candidate. Paste a URL, a resume, ugly LinkedIn copy — any of it works. From there, Wren handles everything between "I found them" and "they signed the offer": screening, pitching, submissions, outreach, follow-ups, replies, interview prep, debriefs, re-engagement.

Sourcing is the *visible* part of the job. Closing is the *real* one. Competitors pitch on the top of the funnel. Wren owns the bottom — the part where the money lives, where relationships deepen, and where every existing tool fails to help.

The moat is the memory. Every interaction, submission, objection, and debrief gets captured and compounds. A recruiter with six months in Wren has a system that knows their book of business. Sourcing tools are replaceable. That is not.

Every build decision defends that thesis. If a feature doesn't help turn a candidate into a placement, it doesn't ship.

---

## The secret

Everyone looks at recruiting and thinks sourcing is the problem. AI recruiting startups pitch volume, outreach automation, and candidate discovery. The real problem is knowing what to do with an elite candidate once you have one: how to close them when it's competitive, what signals matter, what steps to take, how to coach the company. That's where deals are won and lost. Wren codifies the closing motion. That's the secret.

---

## Strategic Thesis: build for the world where sourcing is solved

AI is collapsing sourcing cost to zero. LinkedIn scraping, AI outreach, autonomous agents finding candidates while the recruiter sleeps. Within 18 months every recruiter has a firehose of "qualified" candidates. The moat sourcing tools sold for a decade is evaporating.

When everyone has 500 candidates in their pipeline, the bottleneck moves. The recruiter who wins is not the one with the most candidates. It is the one who knows which five to run hard, which fifteen to nurture, and which 480 to drop without guilt. That is a triage problem. It is also a closing problem. It is also a memory and signal problem.

That is Wren.

**Implications for every build decision:**
- Assume a 10x increase in candidate volume from AI sourcing. Design for overload.
- Do not build a single feature that competes with sourcing tools. They are sprinting toward their own commoditization cliff.
- The candidate database is the asset because it is impossible to act on without intelligence on top, not because it is rare.
- The autonomous overnight agent is not a nice-to-have. It is the only way to operate when a recruiter has 500 active candidates. Every feature should compound toward it.

**Today's recruiter wants more candidates. Tomorrow's recruiter has too many and can't work them.** Wren is the layer that makes a flooded pipeline actionable. Built on time, slightly early, which is the right place to be when the wave is this obvious.

---

## Two-layer messaging (GTM principle)

The buyer is not buying truth. They are buying relief from a pain they already feel.

**Top of funnel — felt pain:** "More deals from the candidates you already have. More closes from the motion you already run. A floor under your worst weeks." Speaks to leverage, sourcing fatigue, deal volume, inconsistency. Gets them in the door.

**Once engaged — real problem:** "The reason you are losing deals is not sourcing, it is what happens after." Reframes the problem. Locks in the value.

Sequencing matters. Felt pain first, real problem second. Lead with the contrarian truth ("everyone sold you sourcing, nobody helped you close") on cold outreach and the message lands abstract. Lead with leverage on cold outreach and the contrarian truth becomes the reframe during the demo.

The headline is leverage. The product is closing intelligence. That gap is where the marketing lives.

For deeper GTM thinking — founder story, objection handling, market analysis, ICP segmentation, positioning experiments — see `POSITIONING.md` in the repo root.

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

**Today:** Most skills fire on button press. Four are event-driven (see below).
**Next:** More skills migrate to event triggers as real-use patterns confirm the right firing conditions.
**Later:** Wren works overnight. Screens incoming resumes. Drafts submissions. Queues follow-ups. Surfaces what needs action tomorrow.

Every feature should move one step toward the later version. The test on every build: *did Wren get more autonomous this session, or just prettier?*

**Event-driven today (fire without a button press):**
- Auto-screen when a candidate is added to a role (fires on pipeline insert)
- Auto-regenerate next action when stage advances (fires on stage change)
- Auto-generate search strings when a role is created (fires on role create)
- Auto-debrief prompt on call/meeting interaction logged

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

**Wren raises the bar.** The tool surfaces gaps in intake, motivation, and process. It pushes back honestly when a recruiter is about to skip a step. Not gatekeeping — honesty. "Wren tells you the truth about your pipeline."

**Cost optimization is a V1 discipline.** Every prompt designed with caching in mind. Every call routed to the right model (Haiku for classification, Sonnet for judgment, Opus for high-stakes reasoning). Batch API for overnight work. Target 60%+ gross margin per user from day one.

---

## Core loop

**The Desk → work the Deals → end-of-day review.**

The Desk (home) answers three questions without scrolling: what's my pipeline worth, what needs attention now, what's happened recently. 90 seconds to read.

In the middle, the recruiter works candidates and roles. Single-click advance. Single-click draft. Sticky Deal Status Bar so the next move is always visible.

End of day is ambient via Actions Tray (future): surfaces what Wren flagged, what's overdue, what's drafted and awaiting send. Clear the tray. Close the laptop.

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
| Evaluation Scorecard | `candidateScorecard.js` |
| Job Description Writer | `jobDescriptionWriter.js` |
| Intake | `intake.js` |
| Submission Draft | `submissionDraft.js` |
| Career Timeline Parser | `careerTimeline.js` |
| Next Action | `nextAction.js` |
| Multi-Screen | `multiScreen.js` |
| JD Extractor | `jdExtractor.js` |
| CV Extraction | `cvExtraction.js` |
| Debrief Extractor | `debriefExtractor.js` |
| Agent Response | `agentResponse.js` |

The skills are the moat. Anyone building a competing product has to hire the same recruiters and extract the same logic. Protect them. Extend them. Never dilute them.

---

## Channel philosophy

Wren is channel-agnostic. It drafts. The recruiter delivers.

**Client submissions** are candidate pitches sent to hiring managers. The channel (email, ATS, submission portal, LinkedIn message) is the recruiter's choice. Wren's job is to make the pitch better than what a tired recruiter writes at 4pm.

**Outreach** is drafted inside Wren, copied and sent by the recruiter. LinkedIn has no API and blocks automation. Chrome extension is v2.

**Email** is the most automatable channel. Drafting works today. Gmail integration is a future milestone.

**Channel recommendation (planned for agent response layer):** Wren recommends the channel before the content. Hierarchy: Call (high stakes, rapport fragile, offer stage) → Video (first meaningful conversation, pre-close) → Email (formal, documented) → LinkedIn (warm network touch) → Text (existing relationship, time-sensitive). Sometimes the output is "pick up the phone" with prep, no drafted message.

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
| `recruiters` | auth user profile. `default_placement_fee_pct` for role creation defaults. |
| `candidates` | full record: `cv_text`, `career_timeline` (JSONB), `career_signals` (JSONB), `enrichment_data` (JSONB). `external_id`, `source`. |
| `roles` | open positions: `notes` (JD), `formatted_jd`, `process_steps` (JSONB), `placement_fee_pct`, `placement_fee_flat`, `target_comp_min`, `target_comp_max`, `openings`, `agreement_id`. `external_id`, `source`. |
| `clients` | companies with contacts. `default_agreement_id`. `external_id`, `source`. |
| `client_contacts` | contacts linked to clients |
| `pipeline` | candidate × role: `current_stage`, `fit_score`, `fit_score_rationale`, `recruiter_score`, `recruiter_note`, `scorecard_result` (JSONB), `screener_result` (JSONB), `next_action`, `next_action_due_at`, `submitted_at`, `last_followup_at`, `expected_comp` |
| `pipeline_stage_history` | every stage movement |
| `interactions` | every touchpoint (call, email, note, meeting) |
| `screener_results` | standalone screener history, no pipeline dependency |
| `messages` | drafted / approved / sent / held outreach |
| `debriefs` | post-interaction signal capture: `outcome`, `feedback_raw`, `summary`, `motivation_signals`, `competitive_signals`, `risk_flags`, `positive_signals`, `hiring_manager_signals`, `next_action`, `questions_to_ask_next`, `updates_to_record` (all JSONB signals) |
| `agreements` | fee agreements, engagement letters, MSAs, NDAs. Raw PDF in Supabase Storage + structured extracted terms. |
| `candidate_imports` | tracks bulk import runs (type, status, counts, report) |

**JSONB where structure will evolve.** Career timeline, signals, process steps, screener results, scorecard results. No migrations needed when the shape changes.

**Row-level security on every table.** Scoped to `current_recruiter_id()`. Helper lives in the initial schema.

---

## Key components

| Component | Role |
|---|---|
| `Dashboard.jsx` | **Desk** — Deal desk home: WrenCommand (Zone 3), Pipeline Value (Zone 1), The Desk (Zone 2). Route: `/desk`. |
| `WrenCommand.jsx` | Command bar. Paste / file / URL → chips → auto-save intake or multi-screen result. Resume auto-parses on drop. File dedup by name+size. |
| `WrenResponse.jsx` | Sticky bottom agent response bar. Shows after every action: thinking animation → message + suggestion chips. |
| `AgentContext.jsx` | Global agent state. `fireResponse(action, context)` fires agentResponse prompt. `dispatch(actionId, context)` routes chip actions via page registry then navigation fallback. `registerAction` / `unregisterAction` for page-level handlers. |
| `CandidateCard.jsx` | Candidate deal view. Deal Status Bar (sticky, replaces old context bar) + three-zone action panel + single-column scroll. Registers `log_debrief`, `log_interaction`, `set_expected_comp` action handlers. |
| `RoleDetail.jsx` | **Deals** — Role-level deal cockpit. Role Status Bar with potential deal value, health pills, next action + three-zone action panel + JD auto-format. Route stays `/roles` for URL stability. |
| `Candidates.jsx` | **Network** — Find past candidates by stage, signal, skill, fit score, recency. Deal history, not inventory. Route: `/network`. |
| `api/ai.js` | Server-side Anthropic passthrough. |
| `src/lib/prompts/` | Every skill. |

---

## Build rules

**Before any feature, run this check:**
- Does it serve the core loop (Desk → work → review)?
- Does it fire on an event or require a button press? (Event is better.)
- Can it be done in one motion?
- Does it compound toward the autonomous agent?
- Is it channel-agnostic?
- Does it earn a place on Desk, Deals, or Network, or does it live inside one of those? (No new top-level nav items.)

If any answer is wrong, redesign or defer.

**Standing constraints:**
- Three top-level surfaces only: Desk, Deals, Network. New functionality lives inside one of them, not in new nav.
- WrenCommand is the highest-leverage surface. Do not complicate it.
- Everything persists. Ephemeral AI output is an antipattern.
- One-click is the bar. More than one motion gets flagged for redesign.
- The Desk's Pipeline Value and Actions Tray are the prioritization layer. That is the core loop, not a dashboard feature.
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
- RoleDetail (Deals) refactored as role-level deal cockpit:
  - **Role Status Bar** (sticky top): role title + client subtitle | potential deal value (big) + current pipeline value + fee label | days open | health pills (Stalled, Cold client, No interviews, Overdue follow-up, Fee not set, Agreement missing, Agreement expiring) | next action
  - Potential deal value: `target_comp_min/max midpoint × openings × fee_pct`, or `fee_flat × openings`. Falls back to sum of `expected_comp × fee` across active pipeline.
  - Health pills derive from pipeline state, stage history, and interactions — non-blocking secondary fetch.
  - Zone A/B/C structure: Zone A = Edit role link; Zone B = Build search strings, Generate IQ; Zone C = Close role, Delete (overflow popover).
  - Network match suggestions: stubbed, logic deferred to next session.
  - JD auto-format on load: if `notes` exists and `formatted_jd` is null, auto-runs cleaning prompt, stores result in `formatted_jd`. No Format button. Raw JD in collapsible `<details>` below.
  - Bug fixes: fee fields now fetched on load (visible after EditRole return); candidate row click has `stopPropagation` on action buttons.
- Candidates (Network): network search by stage, signal, skill, fit score, recency
- Event triggers: auto-screen on pipeline add, auto-next-action on stage advance, auto-search-strings on role create, auto-debrief prompt on call/meeting log
- Recruiter score + AI score as separate permanent tracks on every pipeline entry
- Debrief capture: paste transcript or brain dump → extract structured signal (motivation, competitive, risk, positive, HM signals, next action, questions to ask, record updates) → save to debriefs table → surface on sticky context bar and debrief signals section
- Placement fee fields on roles (% of comp or flat fee, defaults from recruiter profile)
- Schema: `roles.placement_fee_pct`, `roles.placement_fee_flat`, `pipeline.expected_comp`, `recruiters.default_placement_fee_pct`, `roles.target_comp_min`, `roles.target_comp_max`, `roles.openings`, `roles.formatted_jd`, `roles.agreement_id`, `clients.default_agreement_id`, `external_id` + `source` on candidates/roles/clients
- `agreements` table (raw PDF + structured terms) and `candidate_imports` table created
- Nav renamed to Desk / Deals / Network
- Queue removed from nav. File preserved, route preserved. Queue deleted when Actions Tray ships.

**What's been cut:**
- Wren.jsx (chat page) — removed. Contradicted "agent, not chatbot" repositioning. `/api/wren` was a stub.
- Clients.jsx / ClientDetail.jsx — removed. OS-pattern surfaces. Client context lives in RoleDetail.
- Dashboard ActivityDigest / NeedsAttention / TodayPipeline — replaced by deal desk zones.
- Daily Brief skill — removed. Redundant with Dashboard.
- Boolean Search skill — removed. Sourcing tool, not deal desk.
- Queue from nav — removed. File and route preserved until Actions Tray ships.

**V3 priority queue (do not build this session — queued for future):**
- **Call Prep module** (Wednesday build): one module, used across every "pick up the phone" moment. Zone A stubs for "Prep for next interview", "Lock comp expectations", "Prep for counter offer" will route here.
- Custom Hiring Process per Role (intake-extracted, user-confirmable, editable, with semantic stage_type categories for pipeline confidence)
- Recruiter vs AI Confidence (calibration loop)
- Stage-Gate Agent Flows (triggered at late_stage / offer / accepted moments)
- Wren Actions Tray (replaces Queue)
- Bulk Import / Onboarding (candidates, clients, roles, agreements)
- Role activation scans candidate database for existing fits
- Deal scorecard per candidate in pipeline (closeability: motivation, comp alignment, competing offers, HM readiness)
- Close sequence generator by stage (what needs to happen to get from here to offer)

**What's next (current priorities):**
- Thursday: Real use day. Work 2-3 live Paraform candidates end-to-end. Take notes. No building.
- Friday: Fix what Thursday's use surfaces. Top 3 issues only.
- Time-elapsed triggers via Supabase Edge Functions on a schedule
- Auto-set `next_action_due_at` when next action fires

**Do not build:**
- Team features, shared pipelines, assignments
- Chrome extension (v2)
- Gmail integration (v2)
- New analytics or reporting surfaces
- Any second recruiter's feature requests
- New top-level nav items

---

## Call Prep Module (Wednesday build)

Purpose: one module, used across every "pick up the phone" moment. Inputs vary (candidate, client, BD target); format stays consistent. Complements the debrief module — prep before calls, debrief after calls.

**Outputs:**
- What you know about this person right now
- What's changed since you last spoke
- The one thing you need to get out of this call
- The one thing they probably need to hear
- Known risks or sensitivities to navigate (vibes off, counter-offer risk, competing offer)
- A suggested opener. Not a script. One line to get started human.

60 seconds to read. Recruiter picks up the phone prepared, not winging it.

**Routing:**
- CandidateCard Zone A: "Prep for next interview", "Lock comp expectations", "Prep for counter offer"
- RoleDetail Zone A: "Prep for next client call"
- Every BD call, check-in, relationship repair moment

**Design principle:** Wren recommends the right action, not just the right words. Sometimes the output is "pick up the phone" with prep, no drafted message. Good recruiters know when to add value. Great recruiters know when not to.

---

## Recruiter vs AI Confidence (the calibration loop)

Two confidence scores per candidate per role, captured at two moments: before a real interaction and after. Wren's AI score and the recruiter's own rating, stored separately, displayed together.

**Why this matters:**
- Forces the recruiter to commit a read, not just look at Wren's score
- Creates a feedback loop where both sides calibrate over time
- Enables divergence-based pushback ("you said 9, Wren said 5, worth reconciling")
- Produces the demo moment: "my desk learns my closes"

**Data model:**
- `pipeline.recruiter_confidence_pre` (integer, nullable)
- `pipeline.recruiter_confidence_post` (integer, nullable)
- `pipeline.ai_confidence_pre` (integer, nullable, generated by Wren)
- `pipeline.ai_confidence_post` (integer, nullable, generated by Wren)

**Capture moments:**
- Pre-call: when recruiter opens call mode or logs that a call is scheduled, Wren prompts for their confidence score and generates its own
- Post-call: when debrief is saved, Wren asks recruiter for updated confidence and generates its own based on debrief signals

**Display:**
- Deal Status Bar shows both post scores side by side
- CandidateCard has a small "Confidence history" section showing pre/post pairs over time
- Divergence of 3+ points triggers agent response: "You rated this candidate higher than I did. What am I missing? Or is something about your read worth capturing?"

**Calibration view (V2):**
- Recruiter settings page shows accuracy trends: "Your confidence scores lead to placement X% of the time. Wren's confidence scores lead to placement Y% of the time."
- Not built V1, but design data model now so data accumulates from day one

Priority: V1. Small build once core flow is stable.

---

## Stage-Gate Agent Flows

Critical moments in a deal (stage advancements to late stages, offer extended, offer accepted) trigger specific agent responses that surface the right questions and flag missing signals.

Inspired by Paraform's final-round outreach template, but automated and personalized. The recruiter doesn't have to log anything for Wren to know the moment arrived.

**How it works:**
- On stage advance to a `late_stage`, `offer`, or `accepted` type stage, `agentResponse` fires with a stage-specific action
- Context includes all prior debrief signals and checks which critical signals for that stage are missing or thin
- Message congratulates or acknowledges, affirms strength, names gaps
- Suggestion chips address each gap specifically

**Critical signals per stage type:**

`first_interview_complete`:
- Motivation read
- Hiring manager impression
- Candidate energy on the role

`late_stage` (final round or equivalent):
- Competing offers (active and at what stage)
- Comp and equity expectations
- Decision timeline

`offer`:
- Competing offer status
- Timeline of competing processes
- Counter offer risk from current employer
- References arranged
- Start date realistic

`accepted`:
- Resignation conversation prepped
- Counter offer from current employer expected
- Onboarding logistics on both sides

Each flow uses existing `agentResponse.js` architecture with new action types. No new infrastructure.

Priority: V1, likely bundles with Call Prep build.

---

## Wren Actions Tray

Purpose: make Wren's ongoing work visible to the user. Replace Queue with a persistent ambient action layer that surfaces what needs attention across all deals, from anywhere in the app.

Design inspiration: Crusader Kings 3 suggestion panel. Always available, never empty past a certain point, respects dismissals, regenerates based on state.

**Behavior:**
- Persistent across all pages (sticky side or bottom, collapsible)
- Badge count shows pending actions
- Click to expand, see full list sorted by priority
- Each row: icon, short description, entity context, click-to-navigate, dismiss button, snooze button
- Click action navigates to the right surface with context loaded
- Dismiss removes from tray
- Snooze hides for 24 hours
- Vital actions regenerate if ignored past a threshold
- Priority: risk flags > overdue > missing data > opportunities

**Action types Wren generates:**
- Risk flags (counter offer, stalled, cold client, thin motivation)
- Overdue next actions (candidate follow-up due, HM check-in due)
- Missing data (expected comp, fee, target comp range, debrief after logged call)
- Opportunities (network candidates matching active roles, MPC pitch moments)
- Drafted messages awaiting send

**Architecture:**
- `actions` table: `id`, `recruiter_id`, `action_type`, `context` JSONB, `priority`, `created_at`, `dismissed_at`, `snoozed_until`, `linked_entity_id`, `linked_entity_type`
- Actions generator runs on a cadence plus on key state changes
- Client-side render on page load, subscribe to new actions via Supabase realtime

Replaces Queue entirely. Queue gets deleted when Actions Tray ships.

Positioning: proves Wren is always working. Foundation for overnight autonomous mode.

---

## Bulk Import / Onboarding

Purpose: A solo recruiter with years of history shouldn't rebuild their desk from scratch. First-run Wren should feel like they brought their career into the product.

Scope: candidates, clients, roles, and agreements.

**Candidate import:**
- CSV/Excel with column mapping (ATS exports: Bullhorn, Greenhouse, Loxo, Crelate, Recruiterflow, PCRecruiter; LinkedIn Recruiter TSV; personal spreadsheets)
- Bulk resume folder (PDFs/DOCXs via drag-drop or Google Drive)
- Per-row: create record, deduplicate, queue enrichment (CV extraction, career timeline, signals, initial scoring), flag gaps

**Client import:**
- CRM export CSVs and spreadsheets
- Fields: company name, contact info, past roles, past placements, notes, preferred comms
- Dedupe on domain and company name

**Role import:**
- ATS role tables, closed role archives
- Fields: title, client, comp range, status, dates, candidates, outcomes
- Link to clients on import, enrich JDs if attached

**Agreement import:**
- PDFs of fee agreements, engagement letters, MSAs, NDAs
- Parse with Claude: fee %, flat fee, refund clauses, exclusivity, replacement guarantees, payment terms, effective/expiration dates
- Store both raw PDF (Supabase Storage) and structured extracted terms
- Link to client, optionally link to specific role
- User reviews and confirms extracted terms before source of truth
- Agreement informs fee calculations, pipeline value, and Wren pushback on missing/expired contracts

**Data model additions:**
- `candidate_imports` table tracks import runs (built)
- `agreements` table (built; raw PDF + parsed terms JSONB + structured core fields)
- `roles.agreement_id` as optional link (built)
- `clients.default_agreement_id` as fallback (built)

**Pipeline per import:**
- File to Supabase Storage
- Serverless function processes asynchronously
- Reuses existing prompts, adds new `agreementExtractor` prompt
- Progress tracked, report at end

**Surfaces:**
- Onboarding: "Bring your history into Wren" flow after account creation
- Ongoing: Import button on Network, Deals, and Settings
- Agreement review: dedicated review screen after parsing

**Why agreements matter:** Every deal desk move that touches money references a contract. Parsed terms mean pipeline value is grounded in reality, not manual input. Wren surfaces expiring agreements, missing agreements on active roles, terms relevant to stalled deals. Most recruiting tools ignore agreements entirely. Real differentiator.

Priority: V1 important but not this week. Likely ships before second user is onboarded or when demos to prospects begin.

---

## Custom Hiring Process per Role

Purpose: Every client has a different hiring process. Wren adapts to the recruiter's reality instead of forcing candidates into generic stages. Stage semantics also drive pipeline value confidence.

**How it works:**
- Each role has its own ordered set of pipeline stages
- On role creation, Wren runs `processExtractor` prompt against JD + intake notes
  - High confidence extraction: auto-populate stages, user reviews
  - Medium or low confidence: flag user to confirm or create
- Default fallback: generic 6-stage process if user skips
- Editable anytime without losing candidate stage history

**Data model:**
- `pipeline_stages` table: `id`, `role_id`, `stage_order`, `stage_name`, `stage_type` (enum), `stage_description`, `is_interview`
- `pipeline.stage_id` references `pipeline_stages.id`
- `stage_type` enum preserves semantic meaning across custom names

**Stage type enum and default confidence weights (Paraform-style discipline):**

| stage_type | Weight | Description |
|---|---|---|
| `pre_pipeline` | 0.00 | Sourced, in outreach |
| `first_stage` | 0.00 | Intro call, recruiter screen — too early to count |
| `middle_stage` | 0.30 | First real client interview through any non-final round |
| `late_stage` | 0.55 | Final round, panel, team meetings, reference checks |
| `offer` | 0.80 | Verbal, written, in negotiation |
| `accepted` | 0.95 | Signed, pre-start |
| `placed` | 1.00 | Started |
| `lost` | 0.00 | Withdrawn, rejected, declined |

Pipeline value calculation uses `stage_type` weights, not stage name. A candidate in a stage named "Lunch with team" counts as `middle_stage` or `late_stage` depending on how `processExtractor` tags it.

**Triggers for process definition:**
- Role creation (automatic via `processExtractor`)
- Before advancing a candidate to stage 2 on a role with no custom process set (interrupt prompt)

**Surfaces:**
- Role page: horizontal pipeline view under Role Status Bar showing stages + candidate count per stage
- CandidateCard: Deal Status Bar shows current stage using custom name; confidence derived from `stage_type`
- Desk: pipeline value number labeled "Weighted pipeline (from middle stages onward)" so framing is explicit
- Desk deal rows: per-candidate confidence shown (e.g., "Chad · Offer stage · 80% · $42k weighted")
- Agent responses reference custom stage names in suggestions

**New prompt: `processExtractor.js`**
- Input: JD text, intake notes, client context if available
- Output: structured stages array with custom names + `stage_type` tagging + confidence level + extraction notes

**Override capability:** Weights editable per recruiter in settings when that surface exists. Defaults match Paraform-style discipline.

Priority: V1. Likely builds Friday if Thursday's real use surfaces process-mismatch pain (expected).

---

## Data Integration Path

**Phase 1 (now):** Manual entry + bulk import covers all data needs. Solo recruiters on Paraform, spreadsheets, and LinkedIn have full Wren value without integrations.

**Phase 2 (triggered by market signal, not timeline):** Direct ATS integrations. Build order driven by user demand. Likely starting with Paraform, Loxo, Crelate, Recruiterflow. Consider Merge.dev as Unified API accelerator for broader coverage.

**Phase 3 (long game):** Wren becomes the intelligence layer over whichever ATS the recruiter uses. ATS holds the record, Wren runs the deal. Bidirectional sync so Wren's enrichment flows back into the ATS optionally.

**Triggers to start Phase 2:**
- 3+ prospects request the same ATS integration in a short window
- Existing users cite integration as the reason for churn or blocked upgrade
- A prospect says "I'd pay more for this" with ATS integration specifically named

Not a user count threshold. A market signal threshold.

---

## Positioning and Objection Handling

**Founder story:**
"I spent 15 years as a solo recruiter running on LinkedIn and spreadsheets. I was good at the start of the funnel. I was average at the close. I kept losing candidates I should have won. Wren is what I wish I'd had."

**Core objection handling:**

*"I do this already and my process is good."*
"Perfect. Upload it. Wren turns your process into the floor, not the ceiling. You stay the closer. Wren makes sure every candidate gets your A game, not your Thursday afternoon game."

*"I already use [ATS / Gem / Paraform]."*
"Keep using it. Wren sits on top. Your ATS stores the record. Wren runs the deal."

*"AI in recruiting is all hype."*
"Most of it is. Wren isn't doing sourcing or outreach automation. Wren does the deal work between the calls you make. If you're losing closes you should be winning, that's what we fix."

*"I don't have time to learn another tool."*
"You paste your candidate, your notes, your JD. Wren does the rest. If it takes more than one motion it's broken. That's the bar."

*"What about data security?"*
"Everything is yours. Your candidates, your notes, your data. We don't sell data, don't share across users, don't train on your records."

*"I'm a solo recruiter, I don't need enterprise tooling."*
"Right. Wren is built for you specifically. No team features, no admin panels. One operator, one desk, one tool that respects your time."

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
- **ICP locked as solo recruiter with no ATS, LinkedIn + spreadsheets + Paraform.** Secondary users (boutiques, Paraform network, frustrated agency recruiters) are eventually in scope but not the build focus now. Not the user: in-house TA, corporate recruiters, high-volume sourcing shops.
- **Wren is positioned as the intelligence layer, not the system of record.** Coexists with any ATS or no ATS. `external_id` and `source` fields added to candidates, roles, and clients for future optionality. Wren-native records get `source = 'wren'`.
- **Queue to be deleted, replaced by Actions Tray.** Queue is a passive inbox. Actions Tray is ambient, persistent, prioritized, and Wren-generated. Deletion happens after Actions Tray ships.
- **Bulk import scoped for candidates, clients, roles, and agreements.** Agreements parsed via Claude — fee %, refund clauses, exclusivity, expiration. Raw PDF stored in Supabase Storage alongside structured extracted terms. User confirms before source of truth.
- **ATS integrations deferred until market signal.** Trigger: 3+ prospects request the same integration, churn citing integration gap, or explicit willingness to pay. Not a user count threshold. Merge.dev considered as Unified API accelerator.
- **`external_id` and `source` fields added to candidates, roles, clients schema.** Migration A. `source` defaults to `'wren'`. Future imports tag their own source. Intelligence layer data stays separate from source records.
- **Nav renamed to Desk / Deals / Network.** Home → Desk (`/desk`), Roles → Deals (route stays `/roles` for URL stability), Candidates → Network (`/network`). Old paths redirect. Agent copy and recruiter-facing strings ("role", "candidate") unchanged — only nav-level naming. Three surfaces, each with one job. No new top-level nav items.
- **Pipeline stages are per-role, not global.** Custom processes extracted from JD/intake notes via `processExtractor` or user-defined. Generic 6-stage fallback if skipped. Editable without losing candidate stage history.
- **Stage type enum preserves semantic meaning across custom names.** `pre_pipeline`, `first_stage`, `middle_stage`, `late_stage`, `offer`, `accepted`, `placed`, `lost`. Pipeline value confidence derives from `stage_type`, not stage name. "Lunch with team" counts as whatever type `processExtractor` tags it.
- **Pipeline value confidence weights default to Paraform-style discipline.** `pre_pipeline` and `first_stage` = 0 (don't count early-stage candidates). `middle_stage` = 0.30, `late_stage` = 0.55, `offer` = 0.80, `accepted` = 0.95, `placed` = 1.00. Overridable per recruiter in settings.
- **Pipeline value UI makes framing explicit.** Label reads "Weighted pipeline (from middle stages onward)" so the recruiter knows what's being counted and why early-stage candidates don't inflate the number.
- **Recruiter vs AI confidence is a V1 feature.** Two scores per pipeline row at two capture moments (pre-call and post-call). Stored separately. Displayed together. Divergence triggers agent pushback. Calibration view is V2 but data accumulates from day one.
- **Stage-gate agent flows trigger automatically.** `late_stage`, `offer`, and `accepted` advancements fire stage-specific agentResponse flows that check critical signals and surface gaps. Inspired by Paraform's final-round template, but automated.
- **Channel recommendation precedes content generation.** Wren recommends call / video / email / LinkedIn / text before drafting anything. Sometimes the right output is "pick up the phone" with prep, no drafted message.
- **Wren raises the bar is a product principle.** The tool surfaces gaps in intake, motivation, and process. Pushes back when a recruiter is about to skip a step. Not gatekeeping — honesty.
- **Cost optimization is a V1 discipline, not a V2 problem.** Prompt caching, model routing (Haiku/Sonnet/Opus by task stakes), Batch API for overnight work. Target 60%+ gross margin per user from day one.
- **Founder-market fit is the bet.** 15 years as the exact ICP. The founder story leads with struggle, not expertise. Credibility comes from "I lost closes I should have won" more than from "I'm a recruiter."
- **ICP refinement: the buyer is the good closer.** Solo recruiter, 5-20+ years, billing $150k-$1M+, already runs a process and knows their close rate. Wren is leverage, not coaching. Pitch is "do it ten times instead of three." Bad closers buying as a skill upgrade churn at 60 days because volume doesn't fix skill gap. Good closers stay because the floor under off days and the multiplier on best days both compound.
- **Strategic thesis: build for the world where sourcing is solved.** AI commoditizes sourcing within 18 months. When recruiters have 500 candidates instead of 50, the bottleneck moves from finding to working. Wren is the layer that makes flooded pipelines actionable. Every feature assumes 10x candidate volume. Do not build features that compete with sourcing tools.
- **Two-layer messaging is the GTM principle.** Top of funnel: felt pain (leverage, more deals, floor under bad weeks). Once engaged: contrarian truth (closing is the bottleneck, not sourcing). Sequence matters. Lead with leverage on cold outreach. Reframe to closing during the demo. The headline is leverage. The product is closing intelligence.
- **POSITIONING.md is the GTM source of truth.** Founder story, objection handling, market analysis, messaging tests, and ICP segmentation live in `POSITIONING.md` at repo root. WREN.md stays focused on product and codebase context.

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

**PERSPECTIVE FLIP QUESTIONS (V2 intake enhancement):**
Two questions to bake into intake and screening templates:
- To client at role intake: "If you were me and 100% commission-based, would you stop everything to recruit on this role?" Answer informs role health score.
- To candidate at screening: "If you were me and wanted to put you to work for [client], how would you close you?" Answer captured as close risk note.

**OFF-TOPIC FALLBACK (backlog):**
If a user's WrenCommand input doesn't parse as recruiting intent, Wren answers briefly (max 2 sentences) and redirects to real desk state. Three-strike escalation: friendly → sharper → "Wren's here to run your desk. What do you need?"

**CALIBRATION VIEW (V2):**
Recruiter settings page shows accuracy trends for recruiter_confidence vs ai_confidence over time. Data accumulates from V1 build of the calibration loop.

**WREN DESIGN PRINCIPLE:**
"Good recruiters know when they add value. Great recruiters know when they don't." Wren recommends the right action, not just the right words. AI in the middle does not mean AI does all the talking. Sometimes the best move is human.

**KNOWLEDGE TENSION TO RESOLVE LATER:**
Niche depth vs demand following. Both approaches work for different recruiters. Wren should serve the recruiter's strategy, not pick a side. Future setting: weight niche depth or demand signals in role scoring.
