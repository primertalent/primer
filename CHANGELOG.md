# CHANGELOG

Session history. Append to the top after every session. Not read by Claude Code at session start — reference when you need to trace a decision or behavior back to when it shipped.

Format: one session per entry. Date, one-line summary, what shipped. Keep it short.

---

## Session 21 — 2026-05-01
**V3 design system applied. Action card chip bugs fixed. Agent loop first run with real pipeline data.**

**V3 design system (session 1 of 4):**
- Extracted V3 design patterns from `Wren V3 Canvas _standalone_.html` — Fraunces serif, JetBrains Mono, warm parchment palette, square corners, hairline borders, urgency section headers
- Fonts: Google Fonts import for Fraunces (variable optical-size serif), JetBrains Mono, Inter. Applied Fraunces to editorial elements (wordmark, page titles, action messages, empty state). Applied JetBrains Mono to operator labels (section headings, detail labels, stage badges, risk pills, urgency headers).
- Color tokens: `--color-bg: #ede8db` (darker ambient desk), `--color-surface: #f5f1e8` (lighter work surfaces — cards lift from bg). `--color-text: #1a1714`, `--color-muted: #6b655a`, `--color-border: rgba(26,23,20,0.09)` hairline.
- `--radius: 0px` — square corners throughout. All hardcoded `border-radius` values swept (99px→2px, 20/16/12px→2px, 10/8/6/4px→0).
- Urgency sections: Desk now groups action cards as `NOW / TODAY / THIS WEEK` with JetBrains Mono section headers and horizontal rules. Urgency pills removed from persisted cards (section header carries urgency). Ephemeral/live cards keep the blue pill.
- Initial bg/surface swap was inverted (lighter bg, darker cards). Corrected same session: darker sand is ambient, lighter parchment is work surface.

**Action card chip fixes:**
- WrenCommand `onSaved`: was not passing `candidateId` or `roleId` into `fireResponse` context. Fixed — both IDs now forwarded. Cards created on intake are now clickable and chips have entity IDs.
- Desk pipeline enrichment: `roles(title)` select was missing `id`. Fixed — `roles(id, title, ...)` now fetched; `roleId` set on pipeline-linked action cards.
- ActionCard chip filter: `build_search_strings` suppressed as a manual chip everywhere (auto-fires on role creation, redundant as chip). Role-only chips (`add_fee`, `build_search_strings`) filtered when no `role_id` in context. Candidate-only chips filtered when no `candidate_id`.

**Agent loop:**
- First successful run with real pipeline data: 1 pipeline row, 3 actions generated and written to `actions` table.

---

## Session 20 — 2026-04-30
**Commit C + post-commit fixes. Sharpening pass shipped and hardened through real-use testing.**

**Post-commit fixes (live testing revealed):**
- **Side panel layout:** `side-panel-scroll` was missing padding, causing DSB negative margins to overflow and produce a horizontal scrollbar. Fixed: added `padding: 24px 24px 80px` and `overflow-x: hidden` to `side-panel-scroll`. Content now fits cleanly, no horizontal scroll.
- **Comp edit discoverability:** `dsb-comp-value` was a button with no visual affordance — looked like inert text. Added `.dsb-comp-edit` CSS: `cursor: pointer`, hover accent color, pencil icon (`✎`) appears on hover.
- **autoCompleteActions keyword broadening:** Filter was only checking `suggested_next_step` for comp keywords. Loop writes comp context into `why` field. Fixed: filter now checks both `why` and `suggested_next_step` with `/comp|expected|salary|compensation/i`.
- **Desk visual sync on auto-complete:** `autoCompleteActions` was writing `acted_on_at` to DB but Desk state wasn't updating — cards stayed on screen until refresh. Root cause: UPDATE realtime subscription doesn't fire reliably (table lacks REPLICA IDENTITY FULL). Fix: `autoCompleteActions` now returns completed IDs; CandidateCard accepts `onActionsCompleted(ids)` prop; Desk passes `handleActionsCompleted` which filters `persistedActions` optimistically. Matches existing dismiss pattern exactly. UPDATE subscription removed. Three call sites wired: comp save, interaction save, debrief save.
- Test data cleared from Supabase (51 rows). Recruiter and auth preserved.

**Commit C — sharpening pass. Real-use friction resolved across Desk and side panel.**

- **Item 4 (routing):** Back button on full-page CandidateCard now uses `navigate(-1)` with `/network` fallback. Panel mode was already correct.
- **Item 7 (ESC):** SidePanel ESC already worked. Added capture-phase keydown handler in CandidateCard — inner modal ESC now closes the topmost modal before SidePanel's overlay handler fires. All 8 inner modals covered (sub, outreach, linkedin, pitch, iq, comp, debrief, editInteraction, logOpen).
- **Item 5 (Add fee chip):** Removed "Add fee" from ActionCard DEFAULT_CHIPS for `missing_data`. Fee belongs to a role. Agent loop can still emit `add_fee` explicitly on role-linked actions.
- **Item 8 (next_action):** Auto-regenerate on stage advance now writes to `pipeline.next_action` (not `candidates.enrichment_data`). Local `pipelines` state updated immediately. DealStatusBar already reads `pipeline.next_action` — display now correct. Empty state changed from "No next action" to "—".
- **Item 1 (completion state):** Three action states: snooze, dismiss, complete. `acted_on_at` = complete (permanent suppression). Agent loop idempotency: removed `acted_on_at IS NULL` filter — completed rows now block re-generation, dismissed rows still allow it. ActionCard gets Complete button (persisted cards only). Desk adds `handleComplete` + UPDATE realtime subscription so cards disappear immediately on any acted_on_at/dismissed_at update.
- **Item 2 (auto-complete):** `autoCompleteActions()` helper added to CandidateCard. Wired at three save sites: interaction save → complete `follow_up_overdue`; debrief save → complete `risk_flag` + `sharpening_ask`; comp save → complete `missing_data` (keyword-gated to comp-specific rows). `missing_data` is multi-condition so full completion is not safe — keyword heuristic on `suggested_next_step` is the V1 bound. Sub-type field logged as C.5 gap.
- **Item 3 (comp range):** Migration `20260430000001_comp_range.sql` adds `expected_comp_high` (nullable numeric) to pipeline. Parser handles "150k", "150-200k", "$150,000-$200,000" → `{low, high}`. Display: `$150,000 – $200,000`. Comp modal changed to free-form text input with live preview. Edit affordance added (click existing comp value to re-open modal). Pipeline value uses midpoint when range set. `RoleDetail` query updated to fetch `expected_comp_high`.
- **Item 6 (generate normalization):** All five Zone B generators now use modal pattern with editable textarea. Pitch + IQ moved from inline zone-b-result to dedicated modals. IQ JSON parsed and rendered as formatted `BEHAVIORAL / TECHNICAL QUESTIONS` sections (no more raw JSON display). Outreach and LinkedIn done-phases converted from read-only `<p>` to editable `<textarea>` / `<input>`. Submission already had editable textarea. ESC closes pitch/IQ modals via the inner-modal capture handler.
- COLLISION_AUDIT.md: five Commit C out-of-scope items logged (OOS-1 through OOS-5).
- WREN.md current state and What's Next updated. Commit D is now LogForm collapse (was C).

---

## Session 19 — 2026-04-30
**Phase 2 strip down — Commits A and B. SaaS shape → agent shape.**

**Strategy locked:**
- VISION.md created — founder vision document, entry-level recruiter framing, 90-day arc, $499/month pricing thesis
- WREN.md updated — new product framing ("Wren is the entry-level recruiter you can't hire"), ICP updated to $500k-$1M solo billers, three foundations reframed
- POSITIONING.md updated — design principles section added, vocabulary locked (Push/Hold/Kill/Protect)
- COLLISION_AUDIT.md created — 29 findings across 8 patterns, carry-forward items documented, strip down disposition for each

**Full collision audit produced.** Eight pattern types identified: save-handler auto-opens, duplicate input requests, competing surfaces, redundant next-step prompts, SaaS-shape navigation, agent-output-ignored paths, stale trigger patterns, shell vs agent mismatch. Strip down plan written and approved.

**Phase 1 completion (pre-Commit A):**
- Call Prep module shipped (`callPrep.js`) — replaces Zone A stubs with real 60-second pre-call briefs (prep_interview, lock_comp, prep_counter)
- Stage-Gate Agent Flows — advancing to interviewing/offer/placed fires specific action types with missing_signals context
- Recruiter vs AI Confidence — migration adds 4 columns to pipeline, pre/post confidence capture on interaction log and debrief review, divergence ≥3 fires agentResponse, DealStatusBar shows W/Y post scores
- Auto-debrief popup killed — was auto-opening after every call log. WrenResponse chip handles the prompt instead.
- Agent loop: switched default model to Haiku to fix Hobby tier timeout. Curl max-time tightened to 15s.

**Commit A — Desk as primary surface:**
- `src/pages/Desk.jsx` (new): reads `actions` table, batch entity name enrichment, Supabase realtime subscription for new inserts, merges ephemeral cards from fireResponse with persisted actions, three empty states, WrenCommand inline toggle
- `src/components/ActionCard.jsx` (new): urgency badge, entity name/subtitle, Wren's message, suggested_next_step, default chips per action_type, dismiss/snooze
- `src/context/AgentContext.jsx` refactored: fireResponse now writes ephemeral cards instead of bottom bar state. Removed status/response/speak/think/fail/clear. Added ephemeralCards, dismissEphemeralCard. Fixed nested vs flat ID extraction (role.id, pipeline.id). Added REQUIRED_IDS map + dev-mode console.warn on dispatch with missing required IDs.
- `src/components/WrenResponse.jsx` deleted
- `src/pages/Dashboard.jsx` deleted
- `src/components/AppLayout.jsx`: WrenResponse removed

**Bugs fixed (Commit A era):**
- Chip context merge order — model-generated slugs (`suhail_goyal`) were overwriting real UUIDs. Fixed: `{ ...(s.context ?? {}), ...chipContext }` so platform entity IDs always win. agentResponse.js updated to not instruct model to generate entity IDs.
- AgentContext nested ID extraction — roleId/pipelineId were looking for flat `context.role_id` but callers pass `context.role.id`. Fixed to check nested path first.
- Agent loop JSON parse failure — Haiku returning preamble or truncated JSON. Added three-stage parse (direct → strip fences → regex extract). Raised maxTokens 1200→2000. Fixed content block access to find type='text' explicitly.

**Commit B — Side panels:**
- `src/components/SidePanel.jsx` (new): 680px overlay panel, slides from right, Escape/click-outside closes
- CandidateCard: accepts `id`/`onClose` props, AppLayout conditional on panel mode, back/delete use onClose when in panel
- RoleDetail: same treatment
- ActionCard: `onCardClick` prop, card body click opens panel, header and chips stop propagation
- Desk: panel state `{ type, id }`, openPanel/closePanel, SidePanel renders CandidateCard or RoleDetail

**What's next:** Commit C — LogForm collapse (unified log+debrief form, single notes field, background extraction, no modal).

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
