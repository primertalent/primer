# CHANGELOG

Session history. Append to the top after every session. Not read by Claude Code at session start — reference when you need to trace a decision or behavior back to when it shipped.

Format: one session per entry. Date, one-line summary, what shipped. Keep it short.

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
