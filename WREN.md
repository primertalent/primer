# WREN — Standing Context
> Read this at the start of every Claude Code session. Session history lives in CHANGELOG.md.

---

## Current State (updated 2026-06-03)

**Shipped recently:**
- search_db role cross-field matching + model-side expansion + fail-loud (commit 2f0c676, 2026-06-03): role queries now handle compound phrases like "Unit Sales Development" by intersecting per-token title matches with per-token client matches. Model instructed to expand role abbreviations (SDR → "Sales Development", AE, BDR, CSM, etc.) before calling search_db — no hardcoded map, model handles the long tail. New fail-loud rule: any empty search_db result (candidate or role) asks for clarification rather than dead-ending silently.
- search_db full-name split + role status gate removal (commit 2b89e88, 2026-06-03): candidate queries split on whitespace — "Nick Bulow" runs (Nick, Bulow) AND (Bulow, Nick) pair queries plus standalone searches for any 3+ tokens. `.eq('status', 'open')` removed from role search — named lookup must find any role regardless of status. Status returned in results so model can flag non-open roles before drafting.
- Cross-turn memory fix + history bounding (commit 2743df3, 2026-06-03): `buildApiMessages` previously stripped all tool results from prior turns, losing entity IDs (role_id, candidate_id) between requests. Fixed: `runAgentLoop` collects agentic loop steps as `turn_steps` (tool_use blocks + truncated tool_result payloads + final text), saved to `conversation_messages` before the final message row. `buildApiMessages` is now type-discriminated — `turn_steps` rows expand into the full Anthropic interleaved format, enabling cross-turn ID and data continuity. History bounded to 10 turn groups per request (~3000–5000 token tool overhead). Renders remain UI-only and never reach the API payload.
- Voice layer + two-surface submittal model (commit 85784ba, 2026-06-02): rule zero governs all generated claims — fabrication forbidden, motivation guard explicit, recruiter is first-class source, flag once then yield. Internal breakdown (hook, why-fit, screening answers, one named risk — for the recruiter, never sent) and external HM-ready surface (flags resolved, three formats: bulleted/paragraph/concise). Voice layer in `voiceRules.js`: 8 rules, per-recruiter hook, sample injection up to 700 chars. Alex's structural frameworks (pitch structure, objection mechanics) layered under Ryan's voice rules and rule zero — voice wins every conflict. SKILLS_REFERENCE seeding deferred: seeded from real use going forward, not batch-loaded from transcripts. **Validated 2026-06-03 on real candidate (Nick Bulow / Unit SDR):** architecture confirmed. Internal breakdown, working-session transition, and HM-ready external surface all behaved as designed. Voice landed — facts-first, declarative, quantified, clean close. Motivation guard fired correctly ([NEEDS] instead of invented alignment). Three quality bugs surfaced in first real use — logged in FRICTION.md and queued below.
- `/wren` reactive conversation surface (commit f18dce3, 2026-05-28): recruiter asks Wren to do recruiting tasks by text; Wren executes with full DB context, renders results inline, supports multi-turn refinement. Screen results and submittal drafts render as structured inline components. Client objection history unconditionally reaches the screener. Voice samples injected into submittal drafts when present. Working well in first real-use testing.
- Agent loop cron fix (commit d9157eb, 2026-05-28): raised `--max-time` from 15s to 65s in GitHub Actions + upgraded to Vercel Pro (maxDuration: 60 now honored). Root cause was two-layer: Hobby 10s timeout and curl killing the connection at 15s regardless of Vercel's ceiling.
- Surface decision (2026-05-28): conversation is the product. `/wren` is the home route. Desk, Tray, Zones, and candidate pages demoted to deep-review views.
- Agent loop timeout fix (commit 8ab4efc, 2026-05-21): batched per-action dedup from up to 18 serial DB round-trips to 3. Clean run confirmed.
- Handler registry (session 28, 2026-05-20): 18 chip actions across 10 action types resolve inline. CandidateCard and RoleDetail accept `initialState` props to auto-open flows. `useRef` fire-once guards prevent re-trigger on re-render.
- Card lifecycle reliability (session 28): add_fee auto-resolve, `runBackgroundDebrief` extracted to shared lib and fired on ingest path, build_version ghost card prevention, P4-2 on proposed matches, forwarded Gemini Notes name fix.
- Phase 4 sliced (commit 3d577d2, 2026-05-13): Gmail OAuth send live. `api/google-auth.js`, `api/gmail-send.js`, `GoogleAuthCallback` page. `submittal_draft_ready` card has subject preview, To field, Approve & send / Connect Gmail. `gmail_access_token`/`refresh_token`/`token_expiry` on recruiters row.
- Google OAuth scaffolding and token storage shipped, send-scoped (commit 3d577d2). Read + Calendar is a scope expansion on the existing working flow — not a new build.
- P4-2 auto-comp (commit c29f037, 2026-05-13): two-pass extractor writes `expected_comp` on high confidence. Fires when pipeline exists. Never overwrites existing comp.
- P4-1 auto-match (commit 5758274, 2026-05-12): two-pass matcher. ≥90 auto-create pipeline; 60–89 propose with one-click confirm; <60 add-to-role. Wrong-role undo on auto-matched cards.
- Phase 2.5 Build 2 complete (2026-05-05 through 2026-05-13): CloudMailin ingestion, classifier-first reorder, new_inbound action cards, Gemini Notes flow (intake_notes_ready → recruiter-triggered submittal_draft_ready → review/approve-copy/approve-and-send).

**Actively broken:**
- `/api/ai` has no auth gate — any POST with valid body bills the Anthropic key. Pre-beta security blocker. Next PR. Fix: add Supabase JWT check or shared secret. (`/api/wren.js` is already gated via Supabase JWT; `api/ai.js` is the remaining exposure.)
- "Add to a role" buttons broken across Desk chip, DealStatusBar, and sidebar candidate view. Root cause undiagnosed. Workaround: Pipeline section inside candidate page has a working inline button.
- Tier 2 chip wiring incomplete: `prep_for_interview`, `prep_call`, `queue_follow_up`, `draft_urgency_note`, `draft_inbound_reply` open the candidate panel but no specific flow auto-opens inside. Recruiter still has to find the action manually.
- Submittal draft is one-shot generation on Desk — fixed in /wren via multi-turn conversation.
- `pipeline` table is singular — rename to `pipelines` before beta. Will break any raw SQL using old name.

**Next in queue:**
- `/api/ai` auth gate — next PR (pre-beta security blocker). `/api/wren.js` is already JWT-gated; `api/ai.js` is the remaining exposure.
- Screen self-contradiction (session 31 bug): screener and submittal builder each synthesize the same company independently from raw data and reached opposite conclusions — Owner.com flagged as "established venture-backed" in screen concerns, then cited as "early-stage startup" in submittal why-fit. Rule-zero reach. Root cause: tools don't share a resolved fact base. Fix: feed screener output into submittal context so the internal breakdown doesn't re-characterize facts the screen already settled.
- Motivation data dropout (session 31 bug): motivation present in candidate notes/interactions but not flowing into submittal draft synthesis. Both internal and external drafts returned [NEEDS: stated reason] despite the data existing in the record. Draft builder needs to scan notes and recent interactions for motivation signal, not only structured fields.
- Search entry path (session 31 bug): natural-language "screen Nick Bulow against Unit SDR role" still failed on first try despite individual lookups working after fixes. Model may be forming a combined search query instead of two separate entity lookups, or the expansion instruction doesn't fire when both entities are in one request. Needs investigation with SSE log visibility.
- Cost-controls pre-beta — 2 items remaining (history bounding shipped commit 2743df3): (1) Model tiering — Haiku for classification and thin-data routing, Sonnet for judgment and generation. (2) Per-user token visibility — recruiter-level usage tracking so cost per user is measurable before beta pricing locks in.
- Tier 2 chip wiring: dedicated modals or flow wiring for prep/outreach/follow-up chip actions.
- Google OAuth read-scope verification — start this week. Restricted scopes (Gmail read, Calendar, Meet transcripts) trigger Google's app verification review, which takes calendar weeks. Start the submission now, run beta on the test-user allowlist in the meantime. Unblocks Stage 6 (client feedback parsing) and Stage 7 (transcript-driven submittals). Additive to the existing working send flow — not a new build.
- P4-3 (lower priority): `intake_notes_ready` auto-upgrade on manual pipeline insert.
- P4-4 (lower priority): "Add to a role" button root-cause diagnosis.
- P4-5 (pre-beta): `pipeline` → `pipelines` table rename. Audit all raw SQL before executing.

---

## Product Framing (locked)

**Wren is the entry-level recruiter you can't hire.**

It thinks like the recruiter, speaks like them, has 15 years of their judgment built in. It handles the operational work of running a solo recruiting desk so the recruiter can focus on judgment calls and relationships. Not a tool the recruiter operates. An employee they direct.

Domain: hirewren.com. Pitch: "Hire Wren."

Internal architecture description: Wren is the deal desk for solo recruiters. The deal desk is the wedge into a broader operational coverage layer. The agent runs continuously, handles communication and routine operations, and surfaces judgment moments to the recruiter.

For the founder vision document, see `VISION.md`. For GTM, founder story, objection handling, and messaging, see `POSITIONING.md`. Working-with-Claude-Code patterns live in `WORKFLOW.md`. This file (`WREN.md`) is the codebase context.

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

**Wren is never dormant. The deal desk is.**

The conversation is always live. From first contact, Wren ingests, screens, matches, drafts, and maintains context. That's not deal desk logic — that's the employee being present.

**The deal desk trigger:** A candidate enters an active role's pipeline. That's when deal desk logic activates: the agent loop monitors, stage-gate flows fire, risk surfaces, prioritized actions queue. A candidate you're still evaluating doesn't get cold-deal risk flags. One in an active pipeline does.

The old framing conflated "Wren" with "the deal desk." They're different:
- **Wren** — present and active always. Ingests input, drafts responses, answers recruiter questions, maintains the book. No pipeline needed.
- **The deal desk** — activates on pipeline entry. Agent loop, risk flags, stage-gates, prioritized actions. All scoped to active pipeline rows only (`current_stage NOT IN (placed, lost)` and role is active).

**Network match suggestions are the bridge.** When a candidate is added or a role is created, Wren surfaces:
- "This candidate fits your active Inworld AE role. Start a pipeline?"
- "5 people in your network match this new role. Add any to the pipeline?"

The recruiter decides. If yes, the deal starts and the deal desk engages. If no, the candidate stays in Network without deal desk monitoring. Wren never runs deal desk logic on contacts not committed to a deal.

**Implication for build:** the agent loop reads only active pipeline rows (`current_stage NOT IN (placed, lost)`, role active). Network candidates are searchable and matchable but not subject to deal desk monitoring. Roles without pipeline activity are stored but not actively monitored by the loop. Every loop action, risk flag, and stage-gate operates on active pipeline rows.

---

## Candidate Lifecycle

The nine stages of a candidate in Wren. Every build decision should name which stage it touches. This is the spine for sequencing future work.

| Stage | Description | Wren involvement | Status |
|---|---|---|---|
| 1 — Sourcing | LinkedIn, referrals, Paraform. Recruiter finds candidate. | Dormant. Out of scope. | Outside Wren |
| 2 — Intake call | Recruiter speaks with candidate. Gemini Notes captures. Wren extracts fields, auto-creates candidate record, matches to active role, and auto-writes expected comp. | **P4-1 + P4-2 live.** Auto-match fires on 90%+ confidence. Proposed match at 60–89%. Comp auto-extracted from notes on high confidence (regex ≥90, Haiku ≥80); recruiter overrides if wrong. | Live |
| 3 — Resume arrives | CV lands via email or paste. Wren enriches candidate record, flags gaps. | Pattern same as P4-1. Next logical build after P4-2. | Not shipped |
| 4 — Submittal drafted | Wren drafts the pitch from notes + JD on explicit trigger. Recruiter reviews, approves, copies. | Live (Build 2 Piece 3). | Live |
| 5 — Submittal sent | Recruiter sends to client. Wren's job: confirmation, timing, follow-up reminder. | Human action today. Future: Wren-with-approval (Build 3). | Partial |
| 6 — Client feedback | Client responds: schedule, pass, hold. Wren reads email, logs interaction, updates stage. | Blocked on Workspace OAuth (email parsing). Manual log works. | Blocked |
| 7 — Candidate moves through process | Interviews, debriefs, prep, check-ins. Wren runs deal desk logic: surfaces gaps, flags risk, auto-drafts prep. | Debrief extraction live. Stage-gate flows designed. Prep generation is strongest 9pm / soccer game use case. | Partial |
| 8 — Closing motion | Offer extended, negotiation, competing offers, counter-offer risk. Wren surfaces closing checklist, missing signals, mitigation. | Designed in WREN.md (stage-gate flows, recruiter vs AI confidence). Not yet built. **This is the moat.** | Not shipped |
| 9 — Placement + guarantee | Candidate starts. 7/30/60/90-day check-in cadence. Referral ask at 60 days. Testimonial at 90 days. Candidate returns to Network for future role match. | Not built. Contained scope, completes the loop, produces referral revenue. | Not shipped |

**Two stacked intelligence layers:**

- **Operational coverage (Stages 1–7 and 9):** the felt-pain layer. Removes admin tax. Gets the recruiter to use Wren daily. Every day Wren is used, the data gets richer.
- **Deal desk / closing motion (Stage 8, bleeding into 7):** the moat. Codified closing logic that compounds with data. This is where deals are won and lost and where no other tool goes.

The two-layer GTM pitch maps directly: felt pain first (operational coverage), contrarian truth second (closing intelligence). Build stages in order of daily friction removed. The moat becomes defensible once the operational layer makes daily use inevitable.

**Two observations for future builds:**

Intake calls have two subtypes: **candidate intake** (produces candidate record, Stages 2–4) and **client intake** (produces role record — JD, comp range, process, hiring manager context). Currently conflated. A router step is needed in `handleGeminiNotesPath` to classify call type before extraction fires. Client intake calls on Gemini Notes today produce a candidate record for the client contact, not a role record. Build the router before Workspace OAuth brings in all calendar events.

**Implied build sequence (P4-2 shipped 2026-05-13):**
- Phase 4 sliced (Gmail send only) — next build. OAuth scoped to send, not read, no calendar. Delivers approval-based send without full Workspace auth complexity.
- Stage 3 (resume enrichment via email) — same pattern as P4-1, removes a step on every deal
- Full Workspace OAuth — unlocks Stage 6 (client feedback parsing) and Stage 7 (inbound candidate communication)
- Stage 7 prep generation — strongest soccer-game use case, highest urgency felt-pain
- Stage 9 cadence engine — contained, completes the loop, produces referral revenue
- Stage 8 closing motion — built on top of a system that already has data flowing, where the moat lives

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
1. **Email forwarding** — `api/ingest-email.js` + CloudMailin. Shipped 2026-05-05. CloudMailin address `962aaa58086d04d26928@cloudmailin.net` is live for the founder's recruiter row. Gmail forwarding not yet configured — new inbound from Gmail doesn't surface as action cards until Build 2 wires that up.
2. **Google Workspace OAuth** (Phase 4 — proper version of #1): one auth covers Gmail + Calendar + Meet transcripts. Most ICP recruiters live in Workspace. Meet auto-generates transcripts via Gemini if Workspace is enabled.
3. **Granola or Fathom** for non-Google calls (phone, side calls, when Gemini isn't capturing).
4. **Texts** (technically harder; Android easier than iPhone; forwarding-to-Wren as fallback).
5. **LinkedIn** (browser extension, candidate to pipeline in one click — deferred until LinkedIn API or browser ext story matures).

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

## Conversation architecture (decided, not yet built)

**The conversation is the product.** `/wren` is the home route. Wren speaks first, acts without being asked, and renders work inline. Deals, Network, and Desk are deep-review views the conversation opens or renders — not nav peers.

**For Claude Code sessions:** `/wren` is live (commit f18dce3, 2026-05-28). It is the home route. `/desk` remains accessible as a deep-review view. Build plans sequence against `/wren` as the primary surface.

**The four flows:**

**Ingestion** — the front door. Recruiter drops any input (URL, resume, paste, LinkedIn copy). Wren ingests, deduplicates, enriches, matches against open roles. Every other flow starts here. Core tools: `ingest_input`, `search_candidates`, `match_roles_against_candidate`.

**Outreach and sequencing** — draft email + LinkedIn in parallel for a candidate on a role. Manual trigger in v1; 3-day and 7-day follow-ups queue on demand. Core tools: `generate_outreach_set`, `generate_followup`.

**Reply handling** — recruiter pastes inbound reply. Wren classifies intent and drafts the appropriate response. Core tool: `generate_reply`.

**Closing work** — the moat. Three sub-flows: (1) submission to client, calling `get_client_objection_history` before drafting so past rejections shape the pitch; (2) interview prep pack (HM context, talking points, candidate questions, risks); (3) debrief and objection capture, writing structured signal to `debriefs` and updating pipeline state. Core tools: `generate_submission`, `generate_interview_prep`, `capture_debrief`.

**Inline components** rendered in the conversation: `CandidateCard` (compact deal view), `RoleCard` (compact role view), `SubmissionDraft` (editable, Copy/Save/Regenerate/Mark Sent), `DraftSet` (parallel email + LinkedIn drafts), `InterviewPrepCard` (collapsible sections), `DebriefSummary` (structured feedback + next-action suggestion).

**New tables:**
- `conversations` — `id`, `recruiter_id`, `title`, `created_at`, `updated_at`. RLS on `recruiter_id`.
- `conversation_messages` — `id`, `conversation_id`, `recruiter_id`, `role` (user/assistant/tool), `content` (jsonb), `created_at`.

**Files shipped (commit f18dce3):**
- `api/wren.js` — agent endpoint: Anthropic SSE streaming with tool use + agentic loop. Tools: `get_role`, `search_candidate`, `screen_candidate`, `draft_submittal`, `draft_outreach`. Auth: Supabase JWT. `toolScreenCandidate` calls `toolGetRole` unconditionally as first step — client objection history always present. `toolDraftSubmittal` queries `voice_samples` and injects up to 3 samples into the prompt.
- `src/pages/Wren.jsx` — SSE reader, `accText`/`accRenders` local vars (avoids React state closure issues), `draftSeenRef` for isLatest computation, most-recent conversation loaded on mount.
- `src/lib/prompts/wrenAgent.js` — Wren agent system prompt. Lead with work, no re-greeting on prior-day sessions, no em dashes, no filler. Pasted-resume detection phrase locked.
- `src/components/wren/ScreenResult.jsx` — score colored by value (≥7 win, ≥4 mute, else accent), rec pill, strengths/concerns, red flags. All DESIGN.md tokens.
- `src/components/wren/SubmittalDraft.jsx` — `isLatest` prop controls expansion, collapsed drafts show "earlier draft" label, copy button. All revisions preserved in `conversation_messages`.

**LinkedIn enrichment:** Proxycurl is dead (LinkedIn lawsuit, July 2025). v1: recruiter pastes URL or profile text. If URL: `api/fetch-url.js` first, fall back to Apify LinkedIn Scrapers (~$0.005–0.01/profile). Build with `enrichProfile(url)` interface — provider is swappable.

---

## What Wren is

Wren is an agent that works the desk of a solo independent recruiter.

It screens candidates, drafts submissions, flags what needs attention, and keeps the database current while the recruiter is on a call, with a client, or away from the desk. The recruiter opens the day with a brief, works their roles, closes with a queue of actions to review. The agent fills everything in between.

Not an OS. Not a co-pilot. Not a passive chatbot — the interface is a conversation, but Wren speaks first, acts without being asked, and renders work inline. An agent with recruiter logic and a platform to execute and store it.

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

**The conversation is home. Wren speaks, acts, renders.**

The recruiter opens `/wren`. Wren orients: what's active, what's at risk, what's in queue. They talk, paste, or drop — Wren ingests, drafts, surfaces inline cards and panels on demand.

End of day is ambient: drafted messages awaiting send, outstanding follow-ups, anything Wren flagged. The conversation has the context. Recruiter approves, edits, or dismisses.

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
| `api/ai.js` | Server-side Anthropic passthrough (existing skills). |
| `api/wren.js` | Dedicated /wren agent endpoint: SSE streaming, agentic loop, tool execution, JWT auth. |
| `src/pages/Wren.jsx` | `/wren` conversation surface. SSE reader, inline renders, conversation persistence. |
| `src/components/wren/ScreenResult.jsx` | Inline screen result component rendered in the /wren thread. |
| `src/components/wren/SubmittalDraft.jsx` | Inline submittal draft component. `isLatest` prop controls expansion. |
| `src/lib/prompts/wrenAgent.js` | Wren agent system prompt. |
| `src/lib/prompts/` | Every skill. |

---

## Build rules

**Before any feature, run this check:**
- Does it serve the conversation or deepen a view it opens?
- Does it fire on an event or require a button press? (Event is better.)
- Can it be done in one motion?
- Does it compound toward the autonomous agent?
- Is it channel-agnostic?
- Does it belong in the conversation, or in a view the conversation opens? (No new top-level nav items.)

If any answer is wrong, redesign or defer.

**Standing constraints:**
- One surface: the conversation at `/wren`. Deals, Network, and Desk are views the conversation opens or renders — not nav peers. No new top-level nav.
- WrenCommand feeds the conversation (intake, paste, drop). Do not complicate it.
- Everything persists. Ephemeral AI output is an antipattern.
- One-click is the bar. More than one motion gets flagged for redesign.
- The conversation's action surface is the prioritization layer. That is the core loop, not a dashboard feature.
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
  - **Pro tier (upgraded 2026-05-28).** maxDuration: 60 now honored. `--max-time 65` in GitHub Actions cron (5s buffer). Prior Hobby 10s ceiling no longer applies.

- **`/wren` reactive conversation surface (commit f18dce3, 2026-05-28):** Home route. Recruiter types a task, Wren executes with full DB context, renders structured components inline. SSE streaming. Multi-turn refinement. Client objection history unconditionally present in every screen. Voice samples injected into submittal drafts. All draft revisions preserved in `conversation_messages`. Conversations persisted across sessions (most-recent loaded on mount). Working well in first real-use testing.
  - New: `api/wren.js`, `src/lib/prompts/wrenAgent.js`, `src/components/wren/ScreenResult.jsx`, `src/components/wren/SubmittalDraft.jsx`, `src/pages/Wren.jsx`
  - Modified: `resumeScreener.js` (client objection history param + explicit naming instruction), `submissionDraft.js` (voice samples param), `App.jsx`, `AppLayout.jsx`, `index.css` (~301 lines)

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

- **Handler registry pattern (session 28 — 2026-05-20):** 18 chip actions across 10 action types now resolve inline instead of navigating off-Desk to /network or /roles. Desk.jsx registers handlers that call `setPanel` with `initialState`; CandidateCard and RoleDetail accept initialState props that auto-open the relevant flow. `useRef` fire-once guards prevent re-trigger on re-render.
  - Tier 1 (6): `log_interaction`→openLog, `log_debrief`→openDebrief, `draft_submission`→autoOpenSubmission, `set_expected_comp`→openCompFor, `screen_against_role`→autoScreen, `add_fee`→openFee on role panel.
  - Tier 2 (6): `draft_outreach`, `prep_for_interview`, `prep_call`, `queue_follow_up`, `draft_urgency_note`, `draft_inbound_reply` all open the candidate panel without a specific auto-open state (relevant flow must be found inside panel — future wiring tracked in FRICTION.md).
  - Deferred: `find_network_fits`, `match_candidate`.

- **Card lifecycle reliability (session 28 — 2026-05-20):** Five fixes shipped to make Wren feel reliable during real desk use.
  - **add_fee auto-resolve:** Fee save in RoleDetail stamps `acted_on_at` on matching action rows and calls `onActionsCompleted`. Card removed from Desk immediately. Interaction auto-complete expanded: `follow_up_overdue`, `stage_check`, `relationship_warm` all auto-complete on interaction save (was only `follow_up_overdue`).
  - **runBackgroundDebrief shared lib:** Extracted to `api/_lib/runBackgroundDebrief.js`. `generateFn` abstraction keeps the lib transport-agnostic — browser passes `/api/ai` transport, server (`ingest-email.js`) passes Anthropic SDK directly. Gemini Notes Outcome B + C now fire debrief extraction after interaction write. Previously only the CandidateCard UI save path fired it.
  - **build_version filter:** `src/lib/buildVersion.js` (BUILD_VERSION = 1). Migration adds `build_version` column to `actions` (default 1). All insert sites stamp BUILD_VERSION. Desk `loadActions` filters to current build — ghost cards from prior builds excluded without DB cleanup. Bump BUILD_VERSION + deploy to obsolete future ghost cards.
  - **P4-2 on proposed matches:** `api/extract-comp.js` JWT-authed endpoint. `confirm_role_match` handler fires it fire-and-forget after pipeline creation. Comp extraction now runs for both auto-matched (≥90%) and recruiter-confirmed proposed matches (60–89%), not only auto-matches.
  - **Forwarded Gemini Notes name fix:** `extractCandidateNameRegex` captures both participants in "between X and Y" patterns; `recruiterNameHint` (from.name) threads through for forwarded emails and is filtered from candidate candidates. Recruiter's own name no longer becomes the candidate name.

**What's been cut:**
- Wren.jsx (original chat page, removed session ~15) — removed because it was a stub with no real agent loop. Being rebuilt as the decided home architecture — see "Conversation architecture" section.
- Clients.jsx / ClientDetail.jsx — removed. OS-pattern surfaces. Client context lives in RoleDetail.
- Dashboard ActivityDigest / NeedsAttention / TodayPipeline — replaced by Desk action cards.
- Daily Brief skill — removed. Redundant with Dashboard.
- Boolean Search skill — removed. Sourcing tool, not deal desk.
- Queue from nav — removed. File and route preserved until Actions Tray ships.
- WrenResponse.jsx — removed. Desk is the agent's voice.
- Dashboard.jsx — removed. Replaced by Desk.jsx.

**Build plan (organized around the three foundations):**

The pivot from SaaS shape to agent shape happens through three foundations, built in order. Each foundation makes the next one possible.

**Phase 1 — Engine (shipped):**
- ✅ Agent loop infrastructure: GitHub Actions cron, `api/agent-loop` endpoint, `agentLoop.js` prompt, `actions` table
- ✅ Loop reads only active pipeline rows (per "When Wren engages" trigger)
- ✅ Loop output: prioritized actions + sharpening data asks, both writing to `actions` table
- ✅ Call Prep module
- ✅ Stage-Gate Agent Flows (late_stage, offer, accepted triggers)
- ✅ Recruiter vs AI Confidence (data accumulates from day one)

**Phase 2 — Browser strip-down (structurally 60% done, paused at Phase 2.5):**
- ✅ Actions Tray as Desk home: loop output as primary surface, Tray, ActionCard, AppLayout, SidePanel, WrenCommand agent-shaped and shipped
- ✅ WrenResponse removed, log+debrief collapse, side panels
- ✅ Drafts table (migration 20260505000000_drafts.sql), zero consumers yet
- ✅ CF-5, CF-6, CF-7 resolved (see COLLISION_AUDIT.md)
- ⬜ CandidateCard strip-down (pre-strip-down architecture still in place)
- ⬜ RoleDetail strip-down (pre-strip-down architecture still in place)
- ⬜ CF-1, CF-2, CF-4 open; CF-3 partial. Deferred until after Phase 2.5.

**Phase 2.5 — Email ingestion (Build 1 shipped, Build 2 partially shipped):**
- ✅ **Build 1 (shipped 2026-05-05):** `api/ingest-email.js` receives webhooks from CloudMailin. Auth via shared secret (header or query param). Multi-tenant routing via `recruiters.email_intake_address`. Haiku classifier marks emails as `candidate_communication`, `client_communication`, or `noise`. Fire-and-forget agent loop trigger via internal fetch to `api/agent-loop?recruiter_id=...`. Candidate matched by email or fuzzy name, created as stub if no match. Interaction written with classification in `meta` jsonb. Verified end-to-end with two test emails.
- ✅ **Build 2 (fully shipped — Pieces 1 + 2: 2026-05-06, Piece 3: 2026-05-07, Piece 4: 2026-05-12, Piece 4-2: 2026-05-13):**
  - ✅ **Piece 1 — Classifier-first reorder:** Classifier runs before any DB write. Noise discarded to `ingestion_log` table without creating candidates or interactions. Three pre-classifier guards: self-send, domain blocklist (LinkedIn noreply, mailer-daemon, bounce, unsubscribe@), and List-Unsubscribe header detection. `ingestion_log` table created (migration 20260506000001). `interactions.candidate_id` made nullable to support `client_communication` writes. All four guard paths verified in production. Safe to enable Gmail filter forwarding.
  - ✅ **Piece 2 — new_inbound action cards:** Candidate emails surface as action cards in the Desk Tray within 30–60 seconds of arrival, regardless of pipeline status. Cards carry urgency from classifier output, intent-derived why and suggested_next_step, and two chips: "Draft reply" (navigates to candidate page) and "Add to a role" (navigates with autoScreen state). Realtime INSERT handler fixed to derive entity IDs from `payload.new` instead of hardcoding null (commit 5d0fa07). Verified end-to-end with real email tests.
  - ✅ **Piece 3 — Submittal-after-Meet flow (shipped 2026-05-07):** Gemini Notes detection (direct delivery + recruiter-forwarded), guard-1 priority placement so forwarded notes aren't swallowed by the self-send guard. Auto-create candidate via Haiku extraction (current_title, current_company, location, motivation_summary, source_context) when name extracted but no DB match. `intake_notes_ready` action card with inline notes expansion (Fraunces body, JetBrains Mono uppercase headers, hairline dividers). `submittal_draft_ready` card with explicit recruiter-triggered draft → inline review/edit/approve-copy/discard — never auto-generates. Webhook retry idempotency via Message-ID dedup with partial unique index (migration 20260507000001). Picker visibility fix committed as 4c15b25.
  - ✅ **Piece 4 — Auto-match candidate to active role from Gemini Notes (shipped 2026-05-12, commit 5758274):** Two-pass matcher in `api/_lib/matchRoleFromNotes.js`. Pass 1: DB pre-filter on normalized company name (strips legal suffixes, leading "The", comma qualifiers); exact equality first, ≥6-char substring fallback; confidence 95 (single open role at client) or 98 (role title also appears in notes). Pass 2: Haiku fallback for ambiguous or no-company cases, bounded at 200 tokens. Outcome B branches: ≥90 → auto-create pipeline, `intake_notes_ready` card born with `pipeline_id` and `auto_matched: true`; 60–89 → proposed match card, "Confirm [Role]" + "Different role" buttons; no match → existing "Add to a role" unchanged. "Wrong role" undo on auto-matched cards deletes pipeline in-place (no flash). Calibration fields in `actions.context`: `auto_matched`, `auto_match_confidence`, `auto_match_type`, `proposed_match`, `matched_at`, `confirmed_at`. First production instance of "Wren matches before it asks" principle firing on real intake data.
  - ✅ **Piece 4-2 — Auto-extract expected comp from Gemini Notes (shipped 2026-05-13, commit c29f037):** Two-pass extractor in `api/_lib/extractCompFromNotes.js`. Pass 1 regex scans `motivation_summary` (curated by intake Haiku call) then `notes_body` for explicit numeric comp signals within an 80-char keyword window; confidence 90. Pass 2 Haiku fallback bounded at 120 tokens; auto-write threshold 80. Fires only when `pipelineId` exists (P4-1 auto-match must have succeeded — skips proposed-match and no-match paths). Never overwrites existing `expected_comp`. Outcome C also runs when an active pipeline already exists but comp is null. Six calibration fields in `actions.context`: `auto_comp_extracted`, `auto_comp_confidence`, `auto_comp_value_low`, `auto_comp_value_high`, `auto_comp_source_excerpt`, `auto_comp_pass`. Manual `set_expected_comp` chip untouched — stays as fallback.
- ✅ **Phase 4 sliced — Gmail send only (shipped 2026-05-13, commit 3d577d2):** OAuth flow in `api/google-auth.js` (code exchange, token storage on recruiter row). Send via Gmail REST API in `api/gmail-send.js` (RFC 2822 build, token refresh at request time, outbound interaction log on every send, `submitted_at` set on first send only). `src/pages/GoogleAuthCallback.jsx` handles redirect, verifies Supabase session, calls exchange endpoint, navigates to /desk. Migration 20260513000000_gmail_tokens.sql adds `gmail_access_token`, `gmail_refresh_token`, `gmail_token_expiry` to `recruiters`. `submittal_draft_ready` card gains subject preview ("Candidate – Role"), To input, "Approve & send" (when connected, disabled until To filled) or "Connect Gmail" (when not). `gmailConnected` prop threaded from Desk via `!!recruiter.gmail_access_token`. Principle established: Gmail send is a capability, not a card type. Token storage and send endpoint reusable across future card types.
- ⬜ **Build 3:** Deferred. Phase 4 sliced delivered the approval-gated send path.

**Known limitations / tech debt:**
- Candidate name extraction reads the email `from` header only for general inbound emails. For forwarded Gemini Notes specifically, the recruiter hint mechanism now filters the forwarder's name — recruiter's own name no longer becomes the candidate. Body signature parsing for general emails remains unimplemented.
- The `drafts` table first consumer shipped in Build 2 Piece 3 (Gemini Notes capture + explicit draft trigger — 2026-05-07).
- **`/api/ai` has no auth gate.** Any POST with a valid messages body bills the Anthropic key. Pre-existing condition, not introduced by Piece 3. Harden before any beta user signs up: add a Supabase JWT check or shared secret to the route. Piece 3 does not worsen the exposure — `fireResponse` in AgentContext already uses this endpoint.
- **Discard chip on `intake_notes_ready` writes `acted_on_at`, which suppresses re-generation.** Semantically the field name is wrong (the recruiter didn't act, they declined). The behavior is right (recruiter explicitly declining shouldn't surface again on next loop). Future fix is loop-level: distinguish "declined to act" dismissal from "snooze" dismissal. Park until field-name confusion actually causes a debugging issue.
- **"Add to a role" buttons still broken** across the Desk action card chip, DealStatusBar button, and sidebar candidate view despite 4c15b25 picker visibility fix. Root cause undiagnosed. Workaround: scroll to the Pipeline section inside the candidate page and use the inline "+ Add to Role" button there.
- **Section header parser in `intake_notes_ready` uses a heuristic** (single line ≤60 chars, no terminal punctuation, no bullet prefix). Fragile if Gemini ever generates a header longer than 60 chars or ending in punctuation. Acceptable for V1; hardened when Gemini Notes format shifts.
- **Narrow orphan window between draft write and action row update.** If the process crashes between writing the draft record and updating the action row to `submittal_draft_ready`, the draft exists but the recruiter never sees the card flip. Acceptable for V1 single-user. Fix before multi-user.
- **`run_in_background` shell commands using `until curl ...; do sleep N; done` can orphan bash parent processes** after Claude Code considers the task complete. Orphaned loops generated a 401 flood in Vercel logs for hours. Always kill backgrounded processes by explicit PID at the end of any task that started one. Never assume cleanup happened automatically.
- **`pipeline` table is singular, not pluralized.** Inconsistent with Supabase convention. Will cause confusion in future SQL queries. Rename migration needed before beta; any raw SQL using `pipeline` will break.
- **Existing `intake_notes_ready` cards do not auto-upgrade to `submittal_draft_ready`** when a pipeline is created for that candidate after the card was written. Recruiter must manually re-trigger the draft flow. Reduced scope after P4-1: auto-match creates the pipeline at ingestion time so most Gemini Notes cards are born with `pipeline_id` set. The upgrade path only fires for manual "Add to a role" cases. Still open, lower priority than pre-P4-1.
- **`matchRoleFromNotes` company normalization may need tuning.** Suffix list covers common US/EU forms; edge cases (holdings companies, international suffixes, unusual abbreviations) will miss Pass 1 and fall to Haiku. Signal to watch: Pass 1 firing followed by "Wrong role" tap within an hour. Three instances in a week → revisit normalization rules or threshold. Calibration data in `actions.context` provides the signal without instrumentation.
- **`extractCompFromNotes` regex keyword window may need tuning.** 80-char window is a first-pass calibration. Signal to watch: `auto_comp_pass: 'none'` rate in `actions.context` over the first week of real use. High miss rate → widen the window or add keywords. `auto_comp_pass: 'haiku'` doing most of the work → regex patterns too narrow, tighten them so the cheap path fires more.
- **Agent loop cron fix shipped (commit d9157eb, 2026-05-28).** Root cause was two-layer: Vercel Hobby 10s function timeout + curl `--max-time 15` killing the HTTP connection at 15s regardless of Vercel's ceiling. Fixed: Vercel Pro upgrade (maxDuration: 60 honored) and `--max-time` raised to 65s. Watch for re-occurrence as data volume grows beyond ~55s of processing time.
- **DB cleared 2026-05-13.** 5 stale test candidates, 1 stale role, 13 stale clients deleted. Fresh slate for real onboarding from May 14 forward. Recruiter row and auth preserved.
- **Intake call type classification not yet implemented.** Gemini Notes path treats every call as a candidate intake. Client intake calls (producing a role record, not a candidate record) are a distinct call type not yet classified. Router step needed in `handleGeminiNotesPath` to distinguish before extraction fires. Current behavior: a client intake call will produce a candidate record for the client contact, not a role record. Low frequency for now; becomes a problem when Workspace OAuth brings in all calendar events.

**Phase 2.75 — LinkedIn browser extension:**
- Status: captured, not committed. Sequencing decision after Build 2 and Build 3 ship and email ingestion has been used on real candidates for 2+ weeks.
- What it does: Chrome extension that adds Wren to LinkedIn profile and message surfaces. Scrapes visible content (user-consented, acting as the user). POSTs to the existing ingestion endpoint. In-place access to existing skills: screener, scorecard, pitch builder, outreach generators. Save to a role from a profile view. Generate outreach from a profile. Rate against an active JD.
- Why it matters: 60-70% of first responses from candidates come back through LinkedIn, not email. Email ingestion is necessary but not sufficient. LinkedIn has no API for messages. Extension is the only path that doesn't depend on LinkedIn's API and doesn't get shut off.
- Why it's strategic: This is where the work happens. Removes context switching. Skills already built become more useful from this surface. Once installed and trusted, switching cost is real. Demoable in 30 seconds.
- Scope: 1-2 weeks. Manifest V3 compliance, LinkedIn DOM scraping, auth from extension to endpoint, in-extension UI.
- Decision gate: After 2 weeks of real email ingestion use, ask whether email alone feels sufficient or LinkedIn data is constantly missing. If the second, build the extension before Phase 3. If the first, ship Phase 3 first.

**Known ingestion gaps:**
- LinkedIn messages: deferred until extension ships. Manual paste via WrenCommand works for now.
- Phone calls: Granola/Fathom integration deferred to Phase 4.
- Texts: deferred. Lowest signal-to-effort ratio.
- In-person meeting notes: manual paste via WrenCommand works.

**Phase 3 — PWA (earliest day 30, only after ingestion is real and Tray is daily surface):**
- Phone app with push notifications, voice input, voice output, swipe-to-act
- Soccer-game test: open Wren on phone, see top 3 actions, act on one in under 10 seconds

**Phase 4 — Google Workspace OAuth:**
- Full Google OAuth: Gmail + Calendar + Meet transcripts in one auth flow
- Proper version of Phase 2.5 email ingestion, replaces forwarding service
- Granola or Fathom call transcript integration
- Deal scorecard per candidate, close sequence generator, calibration view

**What's next (immediate):**
- **✅ Phase 4 sliced — Gmail send only (shipped 2026-05-13):** Foundation in place. Next validation: send a real submittal to a client from the Desk card.
- **✅ Handler registry + card lifecycle reliability (shipped 2026-05-20):** 18 chip actions resolve inline. Five lifecycle fixes: add_fee auto-resolve, debrief extractor on ingest path, build_version ghost card prevention, P4-2 on proposed matches, forwarded name parse fix.
- **✅ Agent loop cron fix (shipped 2026-05-28, commit d9157eb):** --max-time 65s + Vercel Pro. Loop should run cleanly under current data load.
- **✅ /wren reactive conversation surface (shipped 2026-05-28, commit f18dce3):** Home route live. Multi-turn submittal refinement now possible. Working well in testing.
- **Submittal as multi-turn collaboration:** Now unblocked by /wren. First serious test of the moat moment — recruiter iterates on a real submittal via conversation until it's right.
- **Tier 2 chip wiring (partial fix gap, session 28):** prep_for_interview, prep_call, queue_follow_up, draft_urgency_note, draft_inbound_reply open the candidate panel but no specific flow auto-opens. Recruiter still has to find the action inside the panel. Future build: dedicated modals or wiring to existing prep/outreach surfaces.
- **Card shape conversion pass (queued):** Audit every action card type for SaaS-shape buttons and convert to agent-shape drafts. Driven by friction log. Not a single build; a refactoring lens. Prioritize after friction data accumulates.
  - *Audit prompt when this build comes up:* "Audit all action card types and classify each one as agent-shaped or SaaS-shaped. Agent-shaped = Wren noticed something, explains the senior recruiter move, drafts/proposes the action, and lets the recruiter approve/edit/reject. SaaS-shaped = asks the recruiter to navigate, log, configure, pick, or generate manually. Do not rewrite anything. Return a table: action_type, current card behavior, agent-shaped or SaaS-shaped, recommended one-motion action, priority."
- **P4-3 (lower priority, open):** `intake_notes_ready` auto-upgrade on manual pipeline insert — fires only for manual "Add to a role" cases. See COLLISION_AUDIT.md.
- **P4-4 (lower priority, open):** "Add to a role" button reliability — root cause still undiagnosed. Workaround: scroll to Pipeline section in candidate page.
- **P4-5 (before beta):** `pipeline` table rename to `pipelines`. Audit all raw SQL before executing.
- **Phase 2 completion (deferred until after Phase 2.5):** CandidateCard and RoleDetail strip-down. CF-1, CF-2, CF-4 open; CF-3 partial.
- **Phase 3 (PWA):** Push notifications, voice, swipe-to-act. Earliest day 30, only after ingestion is real and Tray is daily surface.

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


> Positioning, founder story, and objection handling: see `POSITIONING.md`.

> Standing architectural and product decisions: see `DECISIONS.md`.

---

## How to start a session

Read Tier 1 at startup: WREN.md, VISION.md, DECISIONS.md. Pull Tier 2 files (POSITIONING, DESIGN, COLLISION_AUDIT, FRICTION, FRICTION_2026_04_audit, FEEDBACK, WORKFLOW, SKILLS_REFERENCE) only when the session touches their domain. SKILLS_REFERENCE is seeded from real use — when a submittal or outreach genuinely nails Ryan's voice, drop the sent example in full. Never reconstruct from transcripts or memory. Do not batch-load. Any excerpt promoted to the runtime `voice_samples` table gets candidate-specific facts (names, companies, comp numbers) scrubbed — tone calibration only, no real candidate data in the runtime path.

If an `AUDIT.md` is present in the repo root, read that too — it's a session brief with specific work to do.

State what you're building. Full context, no re-briefing needed.

**After each session:**
- Update **Current state** if a new capability shipped or priorities shifted
- Add new architectural decisions to `DECISIONS.md` (new decisions at the top)
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

**CAPTURE AND NETWORK INTELLIGENCE (V2/V3 targets):**

*Mode 3 raw dump parsing.* Multi-intent voice/text input where the recruiter dumps unstructured thoughts. Wren parses entities, structured updates, action items, and free-form context in a single call. Uses Sonnet for parsing depth. Confidence thresholds determine auto-write vs. confirmation-required. Free-form residue stored as notes on relevant entities. Canonical end-of-day dump pattern: recruiter offloads everything in 60-120 seconds, Wren absorbs and structures, recruiter walks away with the work staged.

*Unified outbound interface (Path C).* One compose surface for all Wren drafts, not card-specific compose UIs. Phone surface is voice and action cards only (no keyboard composition). Desktop surface is action cards plus typed WrenCommand for considered composition. Submittal sends remain desk-grade. Routine sends (resume chase, confirmations, info sends) are phone-grade with one-tap approval.

*Candidate tier system.* Wren proposes a tier (S/A/B/C) for every candidate after intake plus resume plus first interaction. Recruiter confirms or overrides via voice or text. Tier stored on candidate row. Surfacing logic reads tier and adjusts proactive output accordingly. Initial prompt set evaluates career signals: companies worked at, role trajectory, quantified output, skills relative to role demand, years-level fit, pedigree, recent track record.

*Elimination system.* Three severity tiers: soft pass, hard pass, permanent red flag. Voice/text capture parses candidate plus reason plus severity plus affected client. Surfacing logic reads elimination state across intake, sourcing, referrals, pipeline reactivation. Permanent red flags surface as warnings on any future system encounter. Client-specific eliminations stay scoped; severity-3 flags travel across all clients with reason context preserved.

*Referral chain tracking.* When a candidate enters via intro from an existing S/A-tier candidate, the referral source is captured on the new candidate row. Network graph compounds: who referred whom, what came of it, attribution preserved. Surfacing logic uses referral signal: candidates from S-tier intros get elevated priority by default. The recruiter sees the chain when working any candidate.

*Network compounding surfaces.* Three distinct proactive surfaces: (1) new-fit-for-old-candidates when a new role lands and Wren matches against the network; (2) BD moments when external signals indicate a client-side opportunity; (3) check-back-in moments when time decay plus tier rating plus motivation signal warrant re-engagement. All three are tier-aware and elimination-aware.

*Onboarding philosophy.* Wren's value compounds with data. Onboarding flow must populate the memory layer with minimum effort from the recruiter. Three layers of capture maturity: zero-effort Workspace OAuth scans Gmail and Calendar history to create candidate existence rows automatically with a first report "I found X candidates in your network"; light-effort WrenCommand accepts CSV, spreadsheet, name list, or resume folder with auto-detected format and routing; real-work manual profile updates and tagging is the last resort, not the first ask. Progressive enrichment: existence rows fire first, context fills in via background enrichment, signal accumulates through use. The first surfacing magic moment is the onboarding success metric. LinkedIn is not integrated: LinkedIn API is closed to small tools, bulk export is limited, and Gmail plus Calendar is the higher-signal data source anyway.

**PARKED CONCEPTS (do not build toward these):**

*Call mode (Wren open/live during a candidate call).* Parked, not building. Proactive ingestion delivers the enrichment value without a live surface: Meet transcripts auto-flow after the call, which eliminates the gap a live-capture mode would solve. The version worth revisiting later — "Wren prepped and present for the call" (prep brief, open [NEEDS] flags, screening questions visible during the call) — only makes sense after auto-ingestion and proactive mode exist, since those determine whether an in-call gap remains. Do not build toward live transcription.

*Feed sustainability — agent-loop conversation harvest.* Parked. The problem: a single infinite /wren conversation is not sustainable over months. The answer is not a chat-history sidebar and not deleting history.

The model: the conversation feed is rolling working space; durable memory lives in the records (candidate, role, pipeline, interactions, actions table). The agent loop becomes the bridge — on its cycle it harvests completed conversations into the records (structured extraction: enrichment to candidates, status changes to pipelines, next actions to the actions table), then rolls the harvested conversation off the active feed into retrievable archive (not deleted — still searchable on explicit ask). The recruiter returns to a clean surface; Wren remembers everything because it's in the records, not the scroll.

Critical design constraints for when this is built:
- Capture = structured extraction into records, never a conversation summary. A pile of summaries is just the infinite scroll again.
- Clear = roll off the active feed + archive, never delete. Occasionally need to review the actual exchange.
- Harvest completed work, not active work. Do NOT blind-clear on a 4-hour timer — that could wipe an in-progress submittal mid-iteration. Clear conversations that are idle and done; leave live threads. This is a readiness judgment, same family as the surfacing-readiness gate.

Build sequence (each step depends on the prior):
1. Ingestion record-writing ships and is tested on real use (currently in progress).
2. Agent loop confirmed reliable over several days (recently resurrected, unproven over time).
3. Then build loop-harvest.

**KNOWLEDGE TENSION TO RESOLVE LATER:**
Niche depth vs demand following. Both approaches work for different recruiters. Wren should serve the recruiter's strategy, not pick a side. Future setting: weight niche depth or demand signals in role scoring.
