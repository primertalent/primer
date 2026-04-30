# Collision Audit — SaaS Shape vs Agent Shape
> Produced 2026-04-30. Reference during Phase 2 strip down.
> Deferred items resolve via architecture inversion. Carry-forward items listed in section 2.

---

## All Findings

| # | Pattern | File | Severity | Disposition |
|---|---------|------|----------|-------------|
| 1.1 | Save auto-opens debrief modal after log | CandidateCard | Blocking | ✅ Fixed |
| 1.2 | compModal gates stage advance (blocking modal vs WrenResponse chip) | CandidateCard | Friction | Carry-forward |
| 2.1 | Notes + debrief raw are the same ask | CandidateCard | Friction | Carry-forward |
| 2.2 | Confidence asked twice with identical labels | CandidateCard | Friction | Carry-forward |
| 2.3 | Role picker collected independently in 4 modals | CandidateCard | Friction | Carry-forward |
| 3.1 | fireResponse fires before debrief modal closes | CandidateCard | Friction | Carry-forward |
| 3.2 | Submission/outreach modals may sit above WrenResponse | CandidateCard | Minor | Resolves in strip down |
| 3.3 | compModal closes → stage-gate WrenResponse fires without context | CandidateCard | Minor | Resolves with 1.2 |
| 3.4 | Fee pill panel + rest of page compete for attention | RoleDetail | Minor | Keep (CSS) |
| 3.5 | Dashboard 3 zones with no hierarchy on arrival | Dashboard | Blocking | Resolves in strip down |
| 4.1 | Zone A "Log debrief" duplicates WrenResponse chip | CandidateCard | Friction | Resolves in strip down |
| 4.2 | Zone A "Log interaction" × 3 surfaces | CandidateCard | Friction | Resolves in strip down |
| 4.3 | DealStatusBar next_action vs WrenResponse suggestions | CandidateCard | Friction | Resolves in strip down |
| 4.4 | RoleStatusBar next_action vs WrenResponse | RoleDetail | Friction | Resolves in strip down |
| 4.5 | build_search_strings double-registered (acceptable) | RoleDetail | Minor | Keep |
| 5.1 | Actions table written but never read by any UI | All | Blocking | Resolves in strip down |
| 5.2 | Desk rows require nav to act | Dashboard | Friction | Resolves in strip down |
| 5.3 | Network page is entirely user-operated filter UI | Candidates | Friction | Resolves in strip down |
| 5.4 | "Edit role" in Zone A navigates to full page | RoleDetail | Friction | Resolves in strip down |
| 5.5 | Nav has no attention signals or badges | AppLayout | Friction | Resolves in strip down |
| 6.1 | Zone B generates without checking debrief signals | CandidateCard | Friction | Carry-forward |
| 6.2 | compModal cancel fires nothing | CandidateCard | Minor | Carry-forward |
| 6.3 | candidate_created WrenResponse context wrong (Desk not CandidateCard) | WrenCommand | Friction | Carry-forward |
| 7.1 | Pill click fires redundant WrenResponse | RoleDetail | Friction | Carry-forward |
| 7.2 | Next action regenerates on every stage advance, overwrites fresh debrief | CandidateCard | Friction | Carry-forward |
| 7.3 | Fee/agreement saves are silent (acceptable) | RoleDetail | Minor | Keep |
| 8.1 | Zone B 5 static buttons regardless of stage | CandidateCard | Friction | Resolves in strip down |
| 8.2 | Network page treats recruiter as filter operator | Candidates | Friction | Resolves in strip down |
| 8.3 | Zone A doesn't use agent loop output | CandidateCard | Friction | Resolves in strip down |
| 8.4 | WrenCommand starts empty, product is dormant on arrival | Dashboard | Blocking | Resolves in strip down |

---

## Carry-Forward Items
> These are data flow patterns that must be explicitly implemented during the strip down rebuild, not just assumed to resolve.

**CF-1 (collision 1.2)** — Stage advance should complete without a blocking comp modal. Remove `compModal`. On advance to a comp-required stage when `expected_comp` is null, complete the advance and surface a `set_expected_comp` chip via the action card.

**CF-2 (collision 2.1)** — Notes field IS the debrief input. In the new single log+debrief form, the single notes textarea becomes `debriefModal.raw`. One field, one save, background extraction.

**CF-3 (collision 2.3)** — Smart role default. When only one active pipeline exists, skip the role picker entirely across all modals (debrief, submission, outreach, LinkedIn). Show picker only when >1 active pipelines.

**CF-4 (collision 6.1)** — Debrief signal check before generation. Before firing `handleGenerateSubmission` or outreach, check `debriefs` for active `risk_flags`. If found, include them in the generation context so the output reflects the risk.

**CF-5 (collision 6.3)** — `candidate_created` agentResponse context fix. After WrenCommand intake saves, WrenResponse (or its replacement) should confirm the save and orient to the Desk — not issue CandidateCard-scoped deal suggestions the user can't act on from where they are.

**CF-6 (collision 7.1)** — Pill click does not fire WrenResponse. Health pill click opens the relevant inline action directly. No redundant agent confirmation of what the user just clicked.

**CF-7 (collision 7.2)** — Next action staleness check. Auto-regeneration on stage advance only fires if `next_action` is null or was last set >72 hours ago. Does not overwrite a freshly captured debrief next action.

---

## What Resolves Automatically in the Strip Down
Everything marked "Resolves in strip down" above disappears because:
- WrenResponse bottom bar is removed — all modal vs WrenResponse collisions go away
- Navigation collapses to side panels — nav-driven discovery patterns go away
- Actions table becomes the primary Desk surface — invisible agent output is exposed
- Zone A/B/C static buttons are replaced by contextual action cards — redundant chips go away
- Dashboard deal list replaced by action cards — SaaS-pattern page structure goes away
