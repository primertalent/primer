# WREN_JD.md — The Job Description

> Wren is the entry-level recruiter you can't hire. This file is its job description.
> It replaces feature-list thinking with job-coverage thinking. Every roadmap item
> maps to a row here. If a feature doesn't advance a row, it doesn't ship.

> The test for every Wren interaction: it must either REMOVE a task the recruiter
> would have done, or TELL THEM something they didn't know. Lookup does neither.
> Retrieval is never the response. It is the setup for the one thing that needs attention.

## The flywheel

Wren does the labor. The labor produces the data. The data produces the insights.
The insights make the labor smarter. Capture is not a feature. It is the exhaust
of doing the work.

## Half one: the labor

Task inventory for a solo biller running 5-8 active deals. Hours are initial
estimates; replace with Ryan's tracked-week data (see calibration note below).
Target tier refers to the autonomy ladder in VISION.md.

| Task | Est hrs/wk | Coverage today | Target tier | Notes |
|---|---|---|---|---|
| Intake capture + data entry | 3-4 | Live (Gemini path, paste); intake now proposes, write-on-approval (not auto-creating pipeline) | 0 (silent) | Proposal path fixes the Tier-0/Tier-1 violation (commit 916ce24); ambient via transcripts post read-scope |
| Screening against role | 2-3 | Live, two moat bugs open | 1 (approve) | Shared fact base fix required |
| Submittal writing | 2-4 | Live, multi-turn, voice layer | 1 forever | Never above Tier 1 per VISION.md email rule |
| Chasing (client + candidate) | 3-4 | Partial (loop flags, drafts) | 2 (act + report) | Earned promotion only |
| Status communication | 2-3 | Barely | 2 | Churn defense: candidates ghost quiet recruiters |
| Scheduling orchestration | 3-5 | Nothing | 2 | Biggest blind spot. Not a scheduler: Wren chases, calendar link books |
| Prep docs | 1-2 | Prompt exists; calendar read live (list_calendar, commit b8d1d18), generation pending | 1 | Calendar-triggered: prep arrives the night before, unprompted |
| Debrief capture | 1-2 | Live | 0 | Ambient via transcripts post read-scope |
| Re-engagement + nurture | ~0 today | Nothing | 2 | Nobody does this manually. Pure new capacity |

Total: 17-27 hrs/wk of coordinator labor. A human coordinator costs $45-55k/yr.
Wren costs $6k/yr. That table is the pricing argument and the landing page.

## Half two: the insights

What a junior with perfect memory and infinite attention notices. Ranked by
buildability against current repo state.

1. Cross-pollination. Every new candidate vs every open role, every new role vs
   the whole network. P4-1 covers half. "This new role matches 3 people you
   already know" is the moment Wren beats an ATS in kind, not degree.

2. Risk detection with specificity. Not "deal stalled" but "day 5 of silence,
   your deals at this client historically die at day 8."

3. Own-history patterns. "Your last three fintech closes locked comp before
   final round. This one hasn't." Requires outcome write-back (Phase 3).
   This is the one no model release can replicate.

4. Forgotten-person resurfacing. Semantic search over the network. Embedding
   column on candidates. Medium build, high wow.

5. Market signal aggregation. "Third candidate leaving Owner.com this quarter."
   Emergent at volume. Do not build now.

6. Relationship graph. Placed candidates become hiring managers in 18 months.
   Stage 9 territory.

## The honesty metric

Percent of Wren's work that Wren initiated. Lives in the brief footer:
"This week: N actions, M initiated by me." Today ~10%. Product is done at 80%.
This stat is the agent-shape test and the anti-SaaS regression alarm.

## Calibration note

Ryan tracks his own desk hours per task for two weeks starting 2026-06-10.
Real ICP numbers replace the estimates above and become the receipt on the
pricing page: "Wren took N hours off my desk in week one."

---

## Current Roadmap (updated 2026-06-25)

Sprint sequence. Strict order. Each item maps to a JD row above.

Sprint 1: Magic moment — COMPLETE

- [x] Scoring reconciliation. One band map, code-derived recommendation — 8-and-hold
  eliminated. Score band determines the call. (commit 9af6eee)
- [x] Submittal formats. Bulleted / Email / Slack / LinkedIn toggle. Lazy cache per
  format. Send uses the on-screen format. (commit bdff711)

Sprint 2a: Entity card primitive — COMPLETE

- [x] CandidateCard, RoleCard, CompanyCard summoned into the thread. get_company tool.
  Computed insights per type. (commit af11344)
- [x] Hardening: enrichment signals -> career_signals, expanded CandidateCard fields,
  entity-pull prose discipline -- card owns facts, prose compresses to read + move.
  (commits 889186d, dc0bda0)

Sprint 2b: Canonical stages + move_stage — COMPLETE

- [x] stages.js + migration: stage_reached, lost_reason, start_date, guarantee_days,
  CHECK constraints. 3 pre-submittal rows detached-and-kept. (commit c9ce8fd)
- [x] move_stage tool: writes pipeline_stage_history, bidirectional moves, backward-reason
  capture, correction-undo, terminal capture, add_to_pipeline writes first history row.
  (commit f250d67)
- [x] Entity-pull prose discipline on all 3 cards; process_steps dropped from get_role
  payload. (commit d3e3620)

Sprint 2c-1: Desk ticker rebuild — COMPLETE

- [x] PIPELINE VALUE (weighted), IN PROCESS (active count), SUBMITTALS THIS WEEK
  (pipeline_stage_history unique by pipeline_id since Monday 00:00 local). AT RISK /
  NEXT MOVE removed. (commit 8c7e81e)
- [x] Ticker comp resolution: expected_comp -> comp_min/max -> target_comp_min/max.
  (commit aa7f6d2)

Sprint 2c-2: Brief + honesty model — NEXT

- While-you-were-away section in morning brief (deal changes since last session).
- Saturday brief: week in review. Sunday brief: next-week goals.
- In-flight deal cards surface in the brief.
- Honesty model: "I don't have a way to save that yet" pattern extended across tool
  gaps as they surface in real use.

Intake autonomy + recall — COMPLETE (2026-06-25)

- [x] Intake proposes instead of auto-submitting; proposal persists in the brief and
  closes on approval. Autonomy-ladder fix (a Tier 1 write no longer fires at Tier 0).
  Single write path, one gate (add_to_pipeline). (commit 916ce24)
- [x] list_pipeline tool (Tier 0 roster) + get_role/get_company rosters (names, not just
  counts). Closes the "who's in process" recall gap. (commit d9a8efb)

Dashboard surface — Chunk 1 COMPLETE (2026-06-25), Chunks 2-3 pending

- [x] Chunk 1: DESK home view above the persistent shell — candidates-in-process ledger +
  active roles. One composer/one thread, WREN|DESK toggle, read-only/anti-CRM, client-side
  RLS reads. (commits 34e0a35, f116d86) Reply indicator: bird flaps composing, static
  alert on unread, no auto-flip. (commit c63834b)
- [ ] Chunk 2: the Record — browsable all candidates/roles/companies + read-only detail.
- [ ] Chunk 3: nav polish.

Sprint 3: Beta readiness

- Onboarding mass upload.
- Google OAuth read-scope verification (submit now; runs parallel to rest of sprint).

Not this sprint (named so they stop nagging):

- Contradiction detection on key fields (prior P1). Data hygiene, queued.
- Ctrl-K client-name search, full ingestion logging, delete tool, brief
  race index. Small, batch later.
- Anything sourcing-adjacent. Never.

Gates: /api/ai auth gate and pipeline -> pipelines rename both CLOSED
(session 34). Remaining external-user gate is the email-connect onboarding
(FRICTION.md 6/12, not beta-shippable), solved in Sprint 3 or by the
Google read-scope path when OAuth verification clears.
