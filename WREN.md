# WREN — Standing Context
> Read this at the start of every Claude Code session. Session history lives in CHANGELOG.md.

---

## Product Framing (locked)

**Wren is the entry-level recruiter you can't hire.**

It thinks like the recruiter, speaks like them, has 15 years of their judgment built in. It handles the operational work of running a solo recruiting desk so the recruiter can focus on judgment calls and relationships. Not a tool the recruiter operates. An employee they direct.

Domain: hirewren.com. Pitch: "Hire Wren."

Internal architecture description: Wren is the deal desk for solo recruiters. The deal desk is the wedge into a broader operational coverage layer. The agent runs continuously, handles communication and routine operations, and surfaces judgment moments to the recruiter.

For the founder vision document, see `VISION.md`. For GTM, founder story, objection handling, and messaging, see `POSITIONING.md`. This file (`WREN.md`) is the codebase context.

The questions Wren answers for every active deal:
- Is this candidate closeable?
- What are the gaps — motivation, comp, competing offers, hiring manager readiness?
- What's the next move to advance or protect this deal?
- Where is this deal at risk?

Beyond the deal desk, Wren handles:
- Inbound communication (read, draft, route, log)
- Outbound prep (interview prep, candidate updates, client check-ins)
- Memory and continuity (no dropped follow-ups, no lost context)
- Coverage (routine work happens whether the recruiter is online or not)
- Pipeline awareness (what's hot, what's at risk, what's worth attention)

Every build decision either advances closing intelligence (the moat) or expands operational coverage (the felt-pain layer that drives adoption).

Proof point: Alex from Super Recruiter built a 7-figure staffing firm by automating operational work with AI for himself. Wren puts that capability in the hands of solo independents. Market is validated.

---

## ICP

Primary buyer: the capacity-constrained solo biller doing $500k-$1M annually. They're leaving money on the table because they can't scale further without help. They'd hire a junior recruiter if the economics worked. They will pay $499/month tomorrow if Wren actually works.

Secondary: solo recruiters billing $200k-$500k. Stretched but making it work. Buy after their peers do.

Profile: solo independent recruiter running on LinkedIn, spreadsheets, email, Google Workspace, and maybe Paraform. No ATS. No coordinator. No team. 5 to 20+ years of recruiting experience.

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

## When Wren engages

Wren is a deal desk. Deal desks engage when there's a deal.

**The trigger:** A candidate enters an active role's pipeline. That's the moment Wren wakes up on that candidate. Before that, Wren is dormant.

Pre-pipeline activities (sourcing, intake, evaluating fit, deciding whether to pursue): the recruiter's work. Wren stores data and offers light intelligence (career timeline parsing, JD extraction, Network search, network match suggestions) but does not run deal desk logic.

Post-pipeline activation: Wren engages fully. The agent loop monitors. Stage-gate flows fire. Risk surfaces. Actions queue. The deal desk runs alongside the deal until placed or lost.

**Network match suggestions are the bridge.** When a candidate is added or a role is created, Wren surfaces:
- "This candidate fits your active Inworld AE role. Start a pipeline?"
- "5 people in your network match this new role. Add any to the pipeline?"

The recruiter decides yes or no. If yes, the deal starts and Wren engages. If no, the candidate stays in Network and Wren goes quiet on them. Wren never forces deal desk logic on contacts that aren't committed to a deal.

**Why this matters.** Wren feels off when used pre-deal. There's no deal to pressure-test, no close to run, no risk to surface. The product has nothing to do. Defining the trigger cleanly removes the pre-deal friction and lets every Wren surface assume "this is an active deal" by default.

**Implication for build:** every Desk surface, every agent action, every risk flag operates on active pipeline rows only. Network candidates are searchable and matchable but not subject to deal desk logic. Roles without pipeline activity are stored but not actively monitored.

---

## The three foundations

Wren is a SaaS shell with agent ambitions. The shape has to invert before the product feels like what it's supposed to be. Three foundations carry the inversion. Build in this order.

**Foundation 1: Engine.** The agent loop runs continuously, not on user action.

A scheduled background job runs every few hours. Reads every active pipeline row, every role, every recent interaction, every recent debrief. Generates a structured assessment of the desk: what's progressing, what's stalled, what's at risk, what's hot, what's cold. Identifies the top actions the recruiter should take next, ranked by urgency. Writes them to an `actions` table.

This runs whether the user is in the app or not. When the user opens Wren, they see what the agent generated since they were last there. That's the inversion: agent initiates, user responds.

**Foundation 2: Ingestion.** Data flows in from where work actually happens.

Manual paste-in is a bridge. It cannot be the destination. Solo recruiters work in Gmail, Google Calendar, Google Meet, LinkedIn, text messages, phone calls. Wren has to read from those sources to feel like an agent.

**Google Workspace is the highest-leverage integration target.** Most ICP recruiters live in Gmail + Google Calendar + Google Meet. One OAuth flow covers all three. Solo recruiter primary intake surface is Google Meet (not phone), and Meet auto-generates transcripts via Gemini if Workspace is enabled — which means transcript ingestion is essentially free once Drive access is granted.

Order:
1. **Gmail** (OAuth, parse incoming candidate and client replies, draft responses inline, write structured interactions). Highest volume of communication.
2. **Google Calendar** (link interviews to candidates, surface upcoming calls, generate pre-call prep automatically).
3. **Google Meet transcripts via Drive** (intake calls, candidate calls — transcript already exists if Gemini is on, just need to read it).
4. **Granola or Fathom** for non-Google calls (phone, side calls, when Gemini isn't capturing).
5. **Texts** (last because technically harder; Android easier than iPhone; forwarding-to-Wren as fallback).
6. **LinkedIn** (browser extension, candidate to pipeline in one click — deferred until LinkedIn API or browser ext story matures).

Each integration removes a manual step. The product gets less cumbersome as more data flows in automatically.

**Foundation 3: Onboarding.** Active recruiters with active books are productive on day one.

The user we want is the active closer with deals in motion right now. Onboarding has to bridge from zero data to enough data to be useful in under 60 minutes, or they bounce.

Three paths in order of leverage:

1. **Pipeline paste:** recruiter describes their active book in free text, Wren parses into structured pipeline rows, candidates, roles, clients. 10 minutes. Day one minimum viable.

2. **Bulk file ingestion:** CSVs, resume folders, fee agreements, exported ATS data. Recruiter drops files, Wren routes and structures asynchronously. Reduces weeks of manual capture to one async job.

3. **Live integrations with backfill:** Gmail backfills 90 days, calendar backfills 30 days, Paraform syncs active roles. Removes manual feeding entirely.

**Wren coaches itself smarter.** The agent loop continuously evaluates its own data poverty and surfaces specific data asks tied to specific deals or moments. Examples:
- "I'd give a stronger read on counter offer risk if I'd seen 2-3 of your past offer-stage deals. Want to add some?"
- "Log a debrief on Sarah's last call, even from memory. Helps me read the deal."
- "Upload your standard fee agreement so I can flag terms when deals hit offer."

These appear as actions on the Desk same as deal actions. Each ask is contextual, tied to a specific payoff. Replaces traditional onboarding forms.

---

## Agent shape vs SaaS shape

Wren is currently SaaS-shaped: the user navigates, configures, clicks, feeds. The agent runs only on user action.

Wren is becoming agent-shaped: the user arrives, sees what the agent did, approves or redirects. The agent runs continuously.

The five tests of agent shape:

1. **The agent has been working.** When the user arrives, there's already output from work done in the background.
2. **The interaction model is approve, edit, override, redirect.** Not search, filter, configure.
3. **The agent has a voice.** First-person or implied first-person. Has takes. Pushes back honestly.
4. **Time is asymmetric.** The agent works while the user doesn't.
5. **The user does less. The product does more.**

Wren has pieces of agent shape today (WrenResponse, debrief extraction, pushback). Wren is mostly SaaS-shaped today (navigation between pages, manual paste, work happens on user click).

Every build decision should move toward agent shape. The test on every session: did Wren get more agent-shaped, or just prettier?

---

## Surfaces: phone-first, browser-as-dashboard

**Phone (PWA) is the operational layer.** Where the recruiter lives 80% of the time. Push notifications, voice in, voice out, swipe-to-act. Soccer game test: see top action, act on one in under 10 seconds, close the app.

Voice is the primary interaction. "Wren, Joan just texted me. Send her prep for her Acme call tomorrow." "Wren, log a call with Mike. He passed because of comp." "Wren, who needs me right now?"

**Browser is the dashboard.** Where the recruiter goes for onboarding, configuration, deep review, history. The 20% of time when they have desk intent.

**The agent loop runs in the cloud.** Both surfaces read from the same agent. The phone is just a different lens on the same engine.

PWA, not native. Faster path, runs on the same React/Vite stack, service worker for push, Web Speech API for voice. Native app is a 6+ month decision.

---

## The 30/60/90 execution arc (locked)

**Days 1-30: Browser strip down.** Phase 2 ships. Actions Tray as Desk home. Side panels. Single working surface. Founder uses Wren on every Paraform candidate daily. By day 30: "I can't run my desk without Wren now."

**Days 30-60: Phone PWA.** Push notifications, voice input, voice output, swipe-to-act. Wren lives in the recruiter's pocket. Mobile-first.

**Days 60-90: First paying users.** 5-10 solo recruiters from network. Beta at $199/month. Real money, real feedback, real testimonials.

**Days 90-180: Scale to 50-100 paying users.** Founder content on LinkedIn, Paraform community, word of mouth. By month 6: $30k-$70k MRR.

**The execution lock:** No major framing pivots until 30 days of daily use. The vision is good enough. Execution is what's missing.

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
- **Desk (Phase 2 — Commit A+B+C):** Agent loop output as primary surface. Reads `actions` table, batch entity enrichment, Supabase realtime INSERT subscription. Three empty states (scanning, caught up, active). WrenCommand inline toggle ("Drop something"). Action cards render Wren's message + suggested_next_step + default chips per action_type + dismiss/snooze/complete. Clicking a card body opens a side panel.
- **Action completion state (Commit C):** Three states: snooze (24h), dismiss (resurfaces on next loop cycle), complete (permanent — `acted_on_at`). Complete button on persisted cards. Auto-complete wired: `follow_up_overdue` on interaction save, `risk_flag`+`sharpening_ask` on debrief save, `missing_data` (comp keyword match on `why` + `suggested_next_step`) on comp save. Completed cards removed optimistically via `onActionsCompleted(ids)` prop callback from CandidateCard → Desk. Agent loop idempotency updated: completed rows suppress re-generation (`dismissed_at IS NULL` is the only re-generation gate); dismissed rows allow it.
- **Side panels (Commit B):** CandidateCard and RoleDetail open as 680px overlay panels from action card clicks. ESC or click-outside closes. Back uses onClose in panel mode, navigate(-1) on full-page routes.
- **AgentContext (Commit A):** fireResponse writes ephemeral cards to Desk instead of bottom bar. REQUIRED_IDS map + dev-mode console.warn on dispatch with missing required IDs. Nested ID extraction fixed (role.id, pipeline.id).
- **WrenResponse (the floating bottom bar) is gone.** Deleted. The Desk is the agent's voice.
- **Dashboard is gone.** Replaced by Desk.
- WrenCommand: paste/upload/URL → auto-saves intake/multi-screen → ephemeral action card confirms on Desk. No Save All button. Resume auto-parses on drop. File dedup by name+size.
- CandidateCard: refactored as a live deal view (not a record view)
  - **Deal Status Bar** (sticky top): candidate name + current role/company | role link | stage + days-in-stage | AI score / recruiter score (color-coded) | risk pills | next action (reads from `pipeline.next_action`, auto-regenerates on stage advance and writes to the correct column) | expected comp range or "Set comp" chip. Comp is click-to-edit when set.
  - **Expected comp (Commit C):** Free-form range input ("150k", "150-180k", "$150,000-$200,000"). Parsed to `{low, high}`. Stored as `pipeline.expected_comp` (low) + `pipeline.expected_comp_high`. Displayed as `$150,000 – $180,000`. Pipeline value uses midpoint for range entries.
  - **Card hierarchy**: Deal Status Bar → Latest debrief summary card → Debrief signals panel → Zone A/B/C actions → Interactions log (3 visible, show more) → Pipeline (collapsed) → Resume & timeline (collapsed) → All debriefs (collapsed) → Career signals (collapsed) → Screener results (collapsed) → Details & edit (collapsed)
  - **Zone A "Work this deal"**: max 3 contextual primary actions via state-based rules.
  - **Zone B "Generate" (Commit C):** All five generators use consistent modal pattern: pick phase (where relevant) → generating → done with editable textarea + copy/regenerate/close. Pitch and IQ moved from inline zone-b-result to modals. IQ JSON parsed and formatted as readable sections (no more raw JSON leak). Outreach and LinkedIn done-phases now use editable textareas.
  - **Zone C "More"**: overflow popover — Call Mode, Edit candidate, Remove from pipeline, Mark as placed.
  - Interaction editing: click any interaction row → edit modal for type + notes. Preserves `debrief_id` link on save.
  - Resume auto-parses on card load if `cv_text` exists but `career_timeline` is null.
  - Inner modal ESC (Commit C): capture-phase keydown handler closes topmost inner modal before SidePanel's overlay handler fires. All eight inner modals covered.
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
- **Agent Loop infrastructure shipped (Phase 1 foundation):**
  - `actions` table with idempotency hash, RLS, dismissal/snooze/acted_on fields (migration 20260429000001)
  - `api/agent-loop` endpoint at `/api/agent-loop`, validates `Authorization: Bearer` against `AGENT_LOOP_SECRET` env var
  - GitHub Actions cron at `.github/workflows/agent-loop.yml` runs every 4 hours, POSTs to the endpoint
  - `src/lib/prompts/agentLoop.js` produces two output categories: active actions and sharpening_ask data requests
  - Reads only active pipeline rows (`current_stage NOT IN (placed, lost)`), joins candidate/role/client/recent interactions/debriefs/stage history
  - Writes prioritized actions to `actions` table with `source_run_id` grouping each cron run
  - Verified working: first run generated a `sharpening_ask` on a Sourced-stage candidate, correctly identified missing interaction data as the highest-leverage gap
  - Hobby tier note: 10s function timeout. Sonnet typically fits in 5–8s. If timeouts recur, swap `claude-sonnet-4-6` for `claude-haiku-4-5-20251001` in `api/agent-loop.js`

- **V3 design system (session 21 — partial, sessions 3+4 pending):**
  - Fonts: Fraunces (variable optical-size serif) for editorial voice, JetBrains Mono for operator labels, Inter for body. Loaded via Google Fonts.
  - Color tokens: `--color-bg: #ede8db` (darker ambient), `--color-surface: #f5f1e8` (lighter work surface), `--color-border: rgba(26,23,20,0.09)` hairline, `--color-text: #1a1714`, `--color-muted: #6b655a`. Cards lift from the desk.
  - `--radius: 0px` — square corners. All hardcoded border-radius values swept.
  - Desk urgency sections: action cards grouped as `NOW / TODAY / THIS WEEK` with JetBrains Mono section headers + horizontal rules. Urgency pills removed from persisted cards.
  - Action card chip fixes: WrenCommand now passes `candidateId`/`roleId` into fireResponse context; Desk pipeline enrichment includes `roles.id`; `build_search_strings` suppressed as manual chip; role/candidate chip filtering by entity ID presence.
  - Agent loop first successful run with real pipeline data: 3 actions generated for 1 pipeline row.
  - Sessions 3+4 pending: verdict pill (PUSH/PROTECT/HOLD/KILL) on action cards, confidence delta display (AI score vs recruiter score side-by-side).
- **Card explosion fix (session 22):** Four-layer dedup across prompt, write gate, ephemeral state, and interaction flow.
  - Prompt (`agentLoop.js`): hard one-per-pipeline-row rule + URGENCY TIERING block (early stages locked to THIS_WEEK unless time-sensitive signal present).
  - Write gate (`api/agent-loop.js`): per-pipeline dedup before every insert — incoming urgency must be strictly higher than any existing active card for that row; otherwise skip. Delete-and-insert (not update) preserves content_hash idempotency.
  - Ephemeral state (`AgentContext.jsx`): changed from append-array to keyed object map (`pipelineId ?? candidateId ?? roleId`). Same entity replaces old card rather than stacking.
  - Auto-debrief (`CandidateCard.jsx`): `runBackgroundDebrief()` fires automatically on every interaction save with notes content. Extracts debrief, saves to DB, updates pipeline next_action, fires `debrief_saved` response, auto-completes risk/sharpening actions. User pastes once, Wren does both.

**What's been cut:**
- Wren.jsx (chat page) — removed. Contradicted "agent, not chatbot" repositioning. `/api/wren` was a stub.
- Clients.jsx / ClientDetail.jsx — removed. OS-pattern surfaces. Client context lives in RoleDetail.
- Dashboard ActivityDigest / NeedsAttention / TodayPipeline — replaced by Desk action cards.
- Daily Brief skill — removed. Redundant with Dashboard.
- Boolean Search skill — removed. Sourcing tool, not deal desk.
- Queue from nav — removed. File and route preserved until Actions Tray ships.
- WrenResponse.jsx — removed. Desk is the agent's voice.
- Dashboard.jsx — removed. Replaced by Desk.jsx.

**Build plan (organized around the three foundations):**

The pivot from SaaS shape to agent shape happens through three foundations, built in order. Each foundation makes the next one possible.

**Phase 1 — Engine (mostly shipped):**
- ✅ Agent loop infrastructure: GitHub Actions cron, `api/agent-loop` endpoint, `agentLoop.js` prompt, `actions` table
- ✅ Loop reads only active pipeline rows (per "When Wren engages" trigger)
- ✅ Loop output: prioritized actions + sharpening data asks, both writing to `actions` table
- ⬜ Stage-Gate Agent Flows wired into the loop (late_stage, offer, accepted triggers)
- ⬜ Custom Hiring Process per Role (loop needs accurate stages to reason about deals correctly)
- ⬜ Recruiter vs AI Confidence (data accumulates from day one even before UI ships)

**Phase 2 — Surface (2-3 weeks):**
- Actions Tray as the Desk's home: loop output rendered as primary surface, replaces deal-list-as-Desk
- CandidateCard collapses into a side panel that opens within the Desk, not a separate page
- RoleDetail collapses similarly
- Mobile experience (mobile web first, native later): single column, action cards, swipe-to-act, no nav
- Push notifications for high-urgency actions
- Soccer-game test: open Wren on phone, see top 3 actions, act on one in under 10 seconds

**Phase 3 — Ingestion (3-4 weeks):**
- Onboarding flow: pipeline paste first (free-text describe active book, Wren parses)
- Bulk file ingestion: CSVs, resume folders, fee agreements
- Gmail integration: OAuth, parse incoming, draft responses inline, structure interactions automatically
- Calendar integration: link interviews, generate pre-call prep automatically
- Granola or Fathom call transcript integration

**Phase 4 — Polish and depth (4 weeks):**
- Beautiful UI matching engine intelligence (single working surface, restrained design, fast)
- MCP marketing prompt at stage advancement (human-in-the-loop)
- Deal scorecard per candidate
- Close sequence generator by stage
- Role activation scans Network for fits
- Calibration view (recruiter vs AI confidence over time)

**What's next (immediate):**
- **V3 session 3:** Verdict pill on action cards — add `verdict` field (`push`/`protect`/`hold`/`kill`) to agent loop prompt output and `actions` table. ActionCard renders verdict pill in JetBrains Mono with Fraunces italic description. Unlocks 2-column card layout.
- **V3 session 4:** Confidence delta on action cards — surface `fit_score` (AI) and `recruiter_score` (human) side-by-side when pipeline row is linked. Fraunces 28px numbers, JetBrains Mono labels.
- **Commit D:** LogForm collapse — unified single log+debrief form. The auto-debrief background extraction is now wired (session 22). What remains: collapse the separate LogForm + DebrieModal UI into a single unified notes textarea; remove the manual debrief trigger from Zone A. Resolves CF-2 and CF-3.
- **Commit E:** Network search overlay + Edit flows inline + nav reduction (Deals/Network items removed from nav).
- **Commit F:** Carry-forward data flow fixes (CF-1 through CF-7 from COLLISION_AUDIT.md).
- Phase 3 (Ingestion): Onboarding pipeline paste, bulk file ingestion, Gmail integration, calendar, call tools
- Phase 4 (Polish): Beautiful UI, deal scorecard, close sequence generator, calibration view

**Do not build:**
- Team features, shared pipelines, assignments
- New analytics or reporting surfaces
- Any second recruiter's feature requests
- New top-level nav items
- Anything that requires the user to navigate to it instead of having it surface to them

---

## Agent Loop (Phase 1 foundation)

The agent loop is the engine that makes Wren agent-shaped instead of SaaS-shaped. It runs continuously whether the user is in the app or not.

**Architecture:**
- Scheduled job (Supabase Edge Function on cron, or Vercel cron) runs every 4 hours
- Reads only active pipeline rows (per "When Wren engages" trigger): pipeline rows where `current_stage` is not `placed` or `lost` and the role is active
- Joined context: candidate record, role record, client record, last 7 days of interactions, all debriefs, stage history, role health flags, agreement status
- Calls a single agent loop prompt with full desk state
- Writes structured output to `actions` table

**`actions` table schema:**
```sql
CREATE TABLE actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL REFERENCES recruiters(id),
  action_type text NOT NULL,
  -- enum-ish: follow_up_overdue, risk_flag, missing_data, opportunity,
  -- stage_check, relationship_warm, sharpening_ask, mcp_opportunity
  linked_entity_id uuid,
  linked_entity_type text,
  -- 'pipeline', 'candidate', 'role', 'client', 'recruiter'
  urgency text NOT NULL DEFAULT 'this_week',
  -- 'now', 'today', 'this_week'
  why text,
  suggested_next_step text,
  confidence text,
  -- 'high', 'medium', 'low'
  context jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz,
  snoozed_until timestamptz,
  acted_on_at timestamptz,
  source_run_id uuid
  -- groups actions generated by the same loop run
);
```

**Agent loop prompt outputs two categories:**

1. **Active actions:** things to do on current deals
   - Follow up overdue with Sarah
   - Lock comp expectations with Chad before final round
   - Inworld has gone cold on Mike's submission, draft check-in
   - Counter offer risk on Jordan, surface mitigation

2. **Sharpening asks:** data inputs that would improve future actions
   - "Add 5 recent placements so I can compare patterns"
   - "Log a debrief on Sarah's last call, even from memory"
   - "Upload your fee agreement to flag offer-stage terms"

Both write to the same `actions` table. The Desk surfaces them sorted by urgency.

**Prompt design principle:** the loop reasons like a senior recruiter scanning the desk. Not rule-based ("days in stage > 7 = stalled"). Pattern-aware ("Sarah's stage advances slowed but interactions stayed warm — likely a process issue, not interest issue, suggest checking with HM"). The codified deal desk logic from the existing prompts compounded at the system level.

**Graceful degradation:** the loop produces useful output even on thin data. Day-one user with 3 pasted pipelines still gets stage-aware suggestions. Month-three user with rich debriefs gets pattern-aware suggestions. Same prompt, more context, sharper output.

**Cost discipline:** loop runs every 4 hours, not continuously. Uses prompt caching aggressively on candidate/role/client records that don't change. Sonnet for the reasoning. Haiku for any pre-classification of which pipelines need full analysis vs light check.

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
- **When Wren engages: active candidate in active role.** That's the trigger. Pre-deal (sourcing, intake, evaluating fit) is the recruiter's work. Wren is dormant for that candidate until they enter an active role's pipeline. Network match suggestions bridge the gap: Wren can surface "this person fits an active role" at moments of new candidate or new role, but the recruiter decides whether to start a deal. Wren never forces deal desk logic on contacts that aren't committed to a deal.
- **Three foundations replace the V1 priority queue framing.** Engine (continuous agent loop), Ingestion (data flowing in from where work happens), Onboarding (active recruiters productive in under 60 minutes). Build phases organized around these foundations, not feature lists. Each foundation makes the next one possible.
- **Agent shape is the bar.** Every build decision tested against five criteria: agent has been working, interaction model is approve/edit/override, agent has a voice, time is asymmetric, user does less and product does more. Wren is currently SaaS-shaped with agent pieces. Goal is full agent shape over the next 8-12 weeks.
- **Agent loop runs continuously, not on user action.** Scheduled job every 4 hours. Reads only active pipeline rows. Generates prioritized actions and sharpening data asks. Writes to `actions` table. The Desk surfaces agent output as the primary surface, replacing deal-list-as-Desk. This is the inversion from SaaS to agent.
- **Wren coaches itself smarter.** Agent loop evaluates its own data poverty and surfaces specific data asks tied to specific deals or moments. Each ask is contextual with a felt payoff. Replaces traditional onboarding forms. The recruiter never asks "why am I doing this." Wren told them.
- **Onboarding is three paths in order of leverage.** Pipeline paste (free-text describe active book, Wren parses) day one. Bulk file ingestion (CSVs, resumes, agreements) phase 3. Live integrations (Gmail, calendar, Granola/Fathom, Paraform) phase 3+. Active recruiter with active book gets to populated, useful Wren in under 60 minutes or they bounce.
- **Manual feel comes from manual feeding, not bad UI.** Wren feels off because the recruiter pastes everything and Wren has no signal until then. UI polish doesn't fix this. Ingestion does. Email integration first, calendar second, call tools third. Each removes a manual step.
- **Don't restart from scratch.** Codebase pivot debt is light. Prompts, schema, agent layer, debrief extraction, provider-agnostic AI all carry forward. Architecture inversion is additive (build the loop, build mobile, build ingestion) not destructive. Refactor frontend after the engine runs, not before.
- **Product framing locked: Wren is the entry-level recruiter you can't hire.** Domain "hirewren.com" matches the pitch ("Hire Wren"). The deal desk thesis is the wedge into broader operational coverage. Internally Wren handles communication, scheduling, prep, signal capture, pipeline awareness, plus closing intelligence as the moat layer. Externally the pitch is "the entry-level recruiter you've always wanted to hire."
- **Proof point: Alex from Super Recruiter.** Built a 7-figure staffing firm by automating operational work with AI for himself. The thesis is validated. Wren puts that capability in the hands of solo independents.
- **Phone-first, browser-as-dashboard.** Phone (PWA) is the operational layer (push, voice, swipe-to-act). Browser is the dashboard (onboarding, configuration, deep review). Both surfaces read from the same agent loop. Soccer game test: see top action, act on one in under 10 seconds.
- **PWA, not native app.** Faster path on existing React/Vite stack. Service worker for push, Web Speech API for voice. Native is a 6+ month decision deferred until product-market fit.
- **Google Workspace is the priority integration.** One OAuth covers Gmail + Calendar + Meet transcripts. Most ICP recruiters live in Workspace. Meet is the primary intake surface (not phone). Gemini auto-transcripts in Drive make Meet ingestion essentially free.
- **Pricing locked at $499/month standard, $199/month beta.** Math: $100k entry-level recruiter is $130-150k loaded. Wren handles 30-40% of that work at $6k/year. ROI is overwhelming for capacity-constrained solo billers ($500k-$1M).
- **ICP refined within ICP: capacity-constrained solo billers ($500k-$1M) are the urgent buyer.** They can't scale further without help. They'll pay $499/month tomorrow if Wren works. Lower-billing recruiters ($200k-$500k) follow word-of-mouth.
- **30-day execution lock.** No major framing pivots until 30 days of daily real use on Paraform candidates. The vision is good enough. Execution is what's missing. The 90-day arc: month 1 strip down, month 2 phone, month 3 first paying users.
- **VISION.md added as the founder vision document.** Anchors everything else. WREN.md is codebase context. POSITIONING.md is GTM. VISION.md is why we're building this and what it ultimately is.
- **COLLISION_AUDIT.md captured for Phase 2 source material.** 32 collisions identified. Most resolve via Phase 2 architecture inversion. Carry-forward data flow fixes woven into the strip down build (CF-1 through CF-7).
- **Three Claude Code build contexts: WREN.md (codebase), VISION.md (founder vision), COLLISION_AUDIT.md (known frictions).** New sessions read all three. POSITIONING.md is for chat-level GTM thinking, not Claude Code sessions.
- **Agent loop ships before any UI changes.** Engine first, surface second. Phase 1 is the foundation that makes Phase 2 (Actions Tray as Desk) possible. Do not build Actions Tray until the loop is producing reliable output.
- **Cron runs on GitHub Actions, not Vercel cron.** Vercel Hobby tier doesn't support custom cron schedules. GitHub Actions is free and identical in behavior: scheduled workflow POSTs to `/api/agent-loop` with a shared secret. Switch to Vercel cron if/when on Pro.
- **Service role key uses the new `sb_secret_xxx` format.** Stored in Vercel as `SUPABASE_SERVICE_ROLE_KEY`. Bypasses RLS for the agent loop's cross-recruiter scan. Never expose this key client-side.
- **Actions table is idempotent via content hash.** Hash is `sha256(recruiter_id:linked_entity_id:action_type:suggested_next_step)`. Cron retries and overlapping runs don't duplicate undismissed actions. `source_run_id` groups all actions from a single loop run.
- **Agent loop prompt designed for graceful degradation.** Day-one user with one Sourced-stage candidate gets a useful `sharpening_ask`. Rich-data user gets pattern-aware actions. Same prompt scales with available context — no separate thin-data path needed.
- **V3 design language: Fraunces + JetBrains Mono + warm parchment.** Fraunces (variable optical-size serif, 400-600 weight) for all editorial/Wren-voice elements. JetBrains Mono for all operator metadata (labels, timestamps, codes, urgency headers). Inter as body font. Three-typeface system, not two.
- **V3 color hierarchy: darker ambient bg, lighter work surfaces.** `--color-bg: #ede8db` (the desk), `--color-surface: #f5f1e8` (cards/work surfaces lift from bg). Borders are hairline translucent `rgba(26,23,20,0.09)`. No white cards on colored bg — work surfaces are warm but reading-weight light.
- **V3 corners: `--radius: 0px` everywhere.** Square corners are load-bearing to the operator aesthetic. Half-doing it looks wrong. `border-radius: 50%` preserved for circular elements (dots, spinners, avatars).
- **Urgency sections replace urgency pills on persisted cards.** Desk groups action cards under `NOW / TODAY / THIS WEEK` ruled headers. Pills on individual cards are redundant when the section header already communicates urgency. Ephemeral (live) cards keep the blue pill since they aren't in a section.
- **`build_search_strings` is never a manual chip.** It auto-fires on role creation. Showing it as a chip is redundant and clutters the action. Suppressed in ActionCard regardless of what the agent suggests.
- **ActionCard filters chips by entity ID availability.** Role-only chip actions (`add_fee`, `build_search_strings`) are hidden when no `role_id` in context. Candidate-only chip actions hidden when no `candidate_id`. Prevents silent no-ops and irrelevant suggestions.
- **WrenCommand must pass entity IDs into fireResponse context.** `candidateId` and `roleId` are available from `onSaved` callback — must be forwarded so ephemeral cards are clickable and chips can dispatch with the right IDs. Missing IDs = unclickable card + silent chip no-ops.

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
