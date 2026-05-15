# Candidate Evaluation Against JD — Worked Example

**Stage:** 4 — Submittal draft
**Demonstrates:** Multi-turn refinement, recruiter context overriding initial AI read, structured output the recruiter can act on
**Tags:** `stage-4-evaluation`, `multi-turn-refinement`

This is a canonical demonstration of the senior recruiter judgment Wren will eventually encode at Stage 4 (submittal draft). It shows how a two-pass evaluation with live recruiter context produces a materially different recommendation from the initial AI read alone.

---

## The scenario

**Candidate:** Ana Teresa Rodriguez
**Role:** Fulcrum FDE Lead

**Pass 1 — AI read with JD and resume only:**
Recommendation: 4/10 PASS
Reasoning: Surface-level resume-to-JD match insufficient for a lead-level role. Missing evidence of leadership scope, team management, and specific domain depth the JD required.

**Recruiter adds two sentences of live context:**
"She ran the data platform migration at her last shop — 3 engineers, 18 months, shipped clean. The Fulcrum team knows her work."

**Pass 2 — AI read with added recruiter context:**
Recommendation: 6.5/10 SUBMIT WITH CAVEATS
Open items before submission: confirm comp alignment, clarify scope of current role relative to the lead step-up, verify Fulcrum's timeline matches her 60-day notice.

---

## What this demonstrates

- **Multi-turn refinement:** The initial read is not the final read. Recruiter context is the input that moves the needle, not prompt engineering.
- **Recruiter context overrides initial AI read:** A 4/10 PASS becomes a 6.5/10 SUBMIT WITH CAVEATS when the recruiter adds two sentences. The delta is entirely attributable to context the AI didn't have.
- **Structured output the recruiter can act on:** The final output names specific open items the recruiter can address before sending. Not a verdict alone — a workplan.

---

## Build implication

The Stage 4 skill must be designed for multi-turn input, not one-shot generation. Initial pass runs on resume + JD. A "What should I know?" prompt to the recruiter captures context the AI lacks. Second pass reruns with that context appended. The recruiter sees both reads side-by-side if they choose. Divergence between Pass 1 and Pass 2 is calibration data.
