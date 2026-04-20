# CHANGELOG

Session history. Append to the top after every session. Not read by Claude Code at session start — reference when you need to trace a decision or behavior back to when it shipped.

Format: one session per entry. Date, one-line summary, what shipped. Keep it short.

---

## Session 18 — 2026-04-20
**WREN.md strategy updates + Role page deal cockpit refactor.**

- **WREN.md**: 7 additive sections — ICP (solo recruiter, no ATS, LinkedIn + spreadsheets), "Wren is not an ATS" architecture principle, Wren Actions Tray spec, Bulk Import / Onboarding spec (candidates, clients, roles, agreements), Data Integration Path (Phase 1/2/3 + market signal triggers), 6 new Decisions Log entries. V3 priority queue updated. Role page redesign removed from deferred list (shipped).
- **RoleDetail refactored as role-level deal cockpit**:
  - Role Status Bar (sticky): drool number (potential deal value) + current pipeline value + fee label | days open | health pills (Stalled, Cold client, No interviews, Overdue follow-up, Fee not set, Agreement missing) | next action. Potential value: `target_comp midpoint × openings × fee_pct`, or `fee_flat × openings`.
  - Health pills: stalled from pipeline_stage_history, cold client from candidate interactions, overdue from `next_action_due_at`. Non-blocking secondary fetch.
  - Zone A/B/C: Zone A = Edit role; Zone B = Build search strings + Generate IQ; Zone C = Close/Delete popover.
  - Network match suggestions: stub UI, logic deferred.
  - JD auto-format on load: fires once if `notes` exists and `formatted_jd` null. Stores clean version in `formatted_jd`. Raw JD in collapsible details below. Format button removed.
  - Candidate row action buttons now `stopPropagation` (fixes link navigation bug).
  - Fee fields (`placement_fee_pct`, `placement_fee_flat`) now fetched on load (fixes EditRole return bug).
- **Queue removed from nav**. File/route preserved. Queue deleted when Actions Tray ships.
- **Schema (pending Supabase run)**: Migration A — `external_id`, `source` on candidates/roles/clients; `target_comp_min`, `target_comp_max`, `openings`, `formatted_jd` on roles. Migration B — `agreements` table, `candidate_imports` table, FK links on roles/clients.

---

## Session 17 — 2026-04-20
**CandidateCard workflow refactor. Deal view, not ATS record.**

- **Deal Status Bar**: replaced old sticky context bar. Two-row layout — identity + role + stage + days-in-stage + AI/recruiter scores + risk pills | next action + expected comp chip. Risk pills (Comp gap, Counter offer risk, Thin motivation, Slow HM, Stalled) derived from debrief JSONB at render time. Counter offer risk also fires on Long Tenure + passive signals.
- **Card hierarchy reordered**: latest debrief summary card → debrief signals → Zone A/B/C actions → interactions log → pipeline (collapsed) → resume/timeline (collapsed) → all debriefs (collapsed) → career signals (collapsed) → screener results (collapsed) → details (collapsed).
- **Zone A "Work this deal"**: state-based rules (stage + last interaction age + debrief status) pick max 3 primary actions. Call-prep stubs for interview/offer-stage actions (Wednesday build).
- **Zone B "Generate"**: submission, outreach, LinkedIn, pitch, interview questions. Pitch + IQ results render inline.
- **Zone C "More"**: popover — Call Mode, Edit, Remove from pipeline, Mark as placed.
- **Interaction editing**: click any interaction row → modal to edit type + notes. Debrief link preserved.
- **Resume auto-parse on load**: if `cv_text` exists but no `career_timeline`, fires once on card mount. No button needed.
- **Interactions log**: 3 visible by default, "show more" expands.
- **Collapsible below-fold sections**: resume, all debriefs, career signals, screener results, details all collapsed by default. Content not rendered until expanded (lazy).
- **WREN.md**: current state updated, new decisions logged, V3 priority queue updated with Call Prep module, Knowledge Base / V2 Feature Concepts section added.

---

## Session 16 — 2026-04-16
**Audit phases 1 and 2. No new features. Debt cleared before real-use testing.**

- Phase 1 (bugs): Removed Anthropic SDK from browser — `claude.js` now always routes through `/api/ai`, `VITE_ANTHROPIC_API_KEY` gone from client, `.env` and `.env.local` gitignored. Added Vite dev proxy (`/api` → localhost:3000). Fixed broken RLS on `screener_results` (new migration — `auth_user_id` → `current_recruiter_id()`). Deleted dead `INTAKE_SYSTEM_PROMPT`, `action: 'classify'`, and `action: 'intake'` branches from `api/ai.js` (29 lines, passthrough only).
- Phase 2 (prompt cleanup): Replaced "recruiting OS" with agent framing in `intake.js`, `dailyBrief.js`, `multiScreen.js`, `nextAction.js`. Removed Paraform reference in `submissionDraft.js`. Added missing migrations for `career_timeline` and `career_signals` columns.
- Dev ergonomics: `npm run dev` now runs `vercel dev` + `vite` together via `concurrently`.
- `AUDIT.md` deleted. `friction.md` created — real-use audit runs 2026-04-16 through 2026-04-23.

---

## Session 15 — 2026-04-15
**Full UI pass. No new features. Every surface reshaped against "what do I do next."**

- Needs Attention cards: two-button layout (filled primary + ghost View). Action labels map to intent: Draft Follow-Up, Run Screener, Set Action, Review Queue.
- Kanban cards: `fit_score_rationale` shown as signal, `next_action` always visible at card bottom. Pipeline query expanded to include both fields.
- Queue: inbox-clear feel. Candidate name + role prominent, first sentence preview only. Drafted items: Edit / Approve & Copy / Hold. Empty state: "You're clear. Nothing waiting." Skeleton loading.
- WrenCommand output: decision-ready packet. Hero name + fit score large, Strengths (3 max), Concerns (2 max), Next Action bold with sage accent. Save All + View Candidate after save.
- Candidate card: replaced 3-column grid with sticky context bar + single column. Sticky bar shows name, scores, next action at all times. Column order: Details, Signals, Career Timeline, Resume Screener, Scores History, Pipeline, Interactions.
- Visual system: shimmer skeleton on Dashboard and Queue loading states. Fade-in on intake results. Warm background and sage accent applied consistently.

---

## Session 14 — 2026-04-14
**Semantic role matching in WrenCommand intake.**

- Open roles fetched before intake fires, injected into the system prompt.
- Model matches by meaning: "GTM lead" resolves to "Go-to-market lead at Inworld". Abbreviations and alternate titles all resolve correctly.
- Returns `role_id` in the intake result. Save All uses it directly, skips DB lookup.
- Bug fixed: "GTM lead" was creating a new role instead of matching existing.

---

## Session 13 — 2026-04-14
**Three event-based triggers shipped.**

- Auto-screen on pipeline add. When a candidate is added to a role from CandidateCard, screener fires automatically in the background. Saves to `screener_results`, writes `fit_score` and `fit_score_rationale` to the pipeline entry. Silent skip if candidate has no `cv_text` or role has no JD.
- Auto-regenerate next action on stage advance. On stage advance success, next action prompt fires in the background. Saves to `candidates.enrichment_data.next_action`, updates card state live.
- Auto-generate search strings on role create. Fires in background after role save, before redirect. Silent skip if no JD text. Strings ready in RoleDetail when recruiter arrives.

---

## Session 12 — 2026-04
**Product reframe: Wren is an agent with a platform, not an OS.**

- Agent / platform framing replaces OS framing everywhere.
- Skill layer documented as the brain. Platform documented as the memory and execution surface.
- Channel philosophy written: Wren drafts, recruiter delivers. Never build for a specific submission platform.
- Paraform renamed to "client submission" across UI and docs.
- Brain / button distinction established: skills are stable, triggers are the thing that evolves.

---

## Session 11b — 2026-04
**Brief overhaul and surface audit.**

- ActivityDigest, NeedsAttention, TodayPipeline added to Brief.
- Speed audit across all surfaces.
- Nav reorder: Home → Roles → Candidates → Queue → Clients.
- Queue defaults to drafted tab.
- CandidateCard header reordered.

---

## Session 11 — 2026-04
**External review constraints and product thinking.**

- External review constraints added (WrenCommand is highest-leverage, everything persists, one-click is the bar, surfaces are a risk, prioritization is the real job, recruiter vs AI delta is data).
- Daily workflow behavioral spec written (since deprecated).
- Product thinking section added.

---

## Session 10 — 2026-04
**Multi-screen mode and recruiter judgment layer.**

- Multi-screen mode: WrenCommand auto-detects 1 resume + 2+ JD chips, routes to comparative AI call. Stack-ranked cards with graduated recommendations.
- Per-card pitch generation on ranking cards.
- Next action setter on CandidateCard.
- Role close / reopen.
- Queue Copy & Send.
- DB-level candidate search.
- Pitch save.
- Next action recruiter override.
- Always-on Needs Attention.
- 4-hour localStorage cache.
- Revenue-first brief prompt.
- Brief renamed to Wren.

---

## Session 9 — 2026-04
**Prompt quality pass and multi-input patterns.**

- Multi-screen mode shipped.
- Inline submission draft.
- JD text from chips saves to `roles.notes`.
- Interview guide persistence.
- JD format button for cleanup AI pass.
- Unscreened badge (yellow) in Fit column.
- LinkedIn recruiter name.
- `Promise.allSettled` in CandidateCard — partial data degrades gracefully, candidate always loads.
- Human writing rules applied across all prompts.

---

## Session 8 — 2026-04
**Recruiter judgment layer.**

- `pipeline.recruiter_score` (1-10) and `pipeline.recruiter_note` added.
- Never touched by AI reruns. Purple badge displayed alongside AI fit score.
- Delta between AI and recruiter score preserved. Both visible simultaneously.

---

## Session 7 — 2026-04
**Edit / delete everything.**

- Every AI-generated or user-logged record is deletable inline.
- × button on hover → inline confirm → optimistic delete with rollback.
- Full edit flows for candidates, roles, clients.

---

## Session 6 — 2026-04
**Full product polish pass.**

---

## Earlier sessions
Pre-session-6 work is not logged here. Repo commit history has the detail if needed.
