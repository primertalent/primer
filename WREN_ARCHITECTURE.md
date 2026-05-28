# WREN_ARCHITECTURE.md — the /wren build spine
> The decided architecture for the conversation-first Wren. Written 2026-05-28.
> This is the spine the /wren build runs against. Fold into WREN.md once /wren ships, then delete this file. Same discipline we used for PATH_B.
> Read this plus VISION.md and DECISIONS.md before any /wren build session.

---

## How we build this without going in circles
> Read this first. It is the reason past sessions failed and this one is meant not to.

The vision has been right for a while. It kept dying in translation. We state the agent, we agree, then the work becomes "add a table, render cards, wire handlers," the build lands on the old SaaS shell, and weeks later it feels like a tool you operate instead of an employee that did the work. The breakdown was never the vision. It was three things, and the build fixes all three on purpose.

**1. The acceptance scenario is the spec, not a feature list.** The build is judged against a scenario running end to end, not against a checklist of tools shipped. If the scenario does not run, it is not done, no matter how much got built. The felt experience is the pass condition. That is how the agent shape survives the trip from idea to code.

**2. Two gates, asked every session, at diagnosis and again at diff.**
- **Shape gate:** does Wren initiate and arrive with work done, or does the recruiter operate it to produce work. If the recruiter operates it, it is the wrong shape. Reject it even if it works.
- **Quality gate:** is the output better than what the recruiter would have produced alone. If it is merely adequate, it fails. We do not touch sourcing, so everything after sourcing has to be exceptional, not okay.

**3. /wren does not import Desk patterns.** Build the conversation surface fresh. Reuse the brain (the existing skill prompts: screen, score, match, draft outreach, draft submission, prep, debrief) as tools the agent calls. Do not reuse the card-render, zone structure, page-navigation, or handler-registry patterns. Those are the SaaS shell. If Claude Code reaches for what exists, the old shape leaks back in.

**Cadence discipline.** Thesis locked indefinitely. Surface locked 30 days (see DECISIONS.md). Incremental small steps are the right pace, they were just pointed at the wrong codebase. Now they build the agent. Every two weeks one session is not a build, it is a shape audit: run the two gates across what shipped and confirm we are still building the agent, not drifting back to forms.

---

## What Wren is

**Wren works without you, and it is sharp as hell when you work together.**

One employee, two modes, one brain. The intelligence does not switch on when you arrive. It was always running. You just join it. Wren does the manual, operational, data-entry work a 2-3 person team would do, except it is trained on 15 years of recruiter logic from day one, it learns how you specifically work over time, it is cheap next to a hire, and it never needs a break.

We do not touch sourcing. You are good at finding people. Wren starts the moment you have a candidate and owns everything after: screening, matching, pitching, submissions, outreach, follow-ups, replies, interview prep, debriefs, re-engagement. The close is the unserved half of the job and the only thing we have to be the best at.

---

## The two modes

Same agent, same context, same conversation. The only difference is who speaks first.

**Proactive (Wren initiates).** Events flow in over time: a call transcript lands, a resume drops, a reply arrives, a debrief gets captured. Wren accumulates each one silently, no recruiter input. When accumulated state crosses the readiness threshold for a high-value action, Wren speaks, in the conversation, with the work already drafted. "Enough on Andrew for a strong submittal, here is the draft." This is the employee working while you are on calls or at the soccer game.

**Reactive (you initiate).** You ask, by voice or text, ad hoc. "Screen this resume against Inworld." "Score this candidate." "Draft a message to Andrew." "Who in my network fits this JD." Wren does it now, with full context no other tool has: your pipeline, your roles, your network, your client history, how you write. Whatever you currently open Claude or ChatGPT to do in your recruiting day, you do in Wren instead, and it is better because Wren knows your desk.

**The behavior split.** Proactive waits for readiness, Wren stays quiet until the deal is ready, so every time it speaks it is actionable by definition. Reactive acts on request even on thin data, and flags what is missing instead of refusing. Wren never blocks you when you ask, and never nags you when you did not.

**Readiness is judged, not configured.** Wren judges whether a deal is ready for an action using recruiter logic ("a strong submittal needs a screen, a resume or equivalent, and confirmed comp"), not rules you set. Thresholds are visible so you can see why it surfaced when it did, and correct it. This is why the old action cards felt dead: they fired on the loop's schedule regardless of whether the deal had enough information to act on. Readiness is the gate that was missing between accumulation and surfacing.

---

## The three-layer brain

Both modes read from one context with three layers.

1. **Encoded recruiter logic.** The 15 years, the skill prompts, the baseline judgment every Wren ships with. General. Ships in the prompt.
2. **Your book of business.** Your pipeline, roles, network, debriefs, client history. The context that makes every task specific to your desk. The database the loop fills.
3. **You.** How you write, what you value, what you pass on and why, how you position. Learned from your edits and choices over time. The deepest moat, and the thing a competitor cannot copy.

A competitor can clone layer 1. They cannot clone two years of layer 2 and 3 on your desk.

**Instrument layer 3 from day one.** v1 does not need to feed edits back into the prompt yet, but it must log every edit and every judgment call now, so the day learning turns on there is a history to learn from and not a cold start.

---

## The acceptance test

This is the scenario the /wren build runs against. If it runs end to end with only judgment clicks, the product is real.

> Multiple call transcripts land over a window. Wren captures each one silently, no recruiter input. For every candidate that crosses submittal-readiness, a draft is waiting when the recruiter returns. The send-ready ones need a glance and a send. At least one needs multi-turn collaboration, and the recruiter refines it live with Wren in conversation until it is right, then sends. No navigation, no forms, no card-hunting. The only recruiter actions in the whole flow are judgment: approve, or shape-then-approve.

**The quality bar on top of the scenario.** The four drafts are not enough just by existing. The recruiter has to look at them and think "that is better than I would have done in the time I had." The collaborated ones have to end up better than solo work, not just faster. Four mediocre drafts the recruiter rewrites means the loop ran and the product failed.

**Build order against the dependency.** Thing one (silent capture off transcripts) depends on Meet transcript ingestion, which depends on the Workspace OAuth read-scope expansion (see below). So the first /wren slice is the reactive mode and the conversation surface, which work on existing and pasted data with no new dependency. Proactive readiness-drafting comes once transcript ingestion is live.

---

## What we reuse, what we build fresh

**Reuse (the brain):** the existing skill prompts as agent tools. Screen, score against role, match candidate to roles, match roles to candidate, draft outreach, draft submission, generate interview prep, capture debrief, plus DB read/search. These are hands the agent calls. Both modes use the same tool layer. One context, one tool set, two triggers.

**Build fresh (the shape):** the conversation surface. A streaming chat at /wren that renders rich inline components for candidates, roles, drafts, prep, debriefs. Wren speaks first on mount in proactive mode. Editable drafts that support multi-turn refinement in place. Voice in and out is the target, text first is fine for v1.

**Do not reuse:** Desk, Actions Tray, Zones A/B/C, candidate/role full pages as the primary surface, handler registry, card-navigation patterns. These are demoted to deep-review views the conversation can open or render. They are not home and not nav peers.

---

## Ingestion and the OAuth dependency

Manual paste is the bridge, not the destination. The dream's first half ("four hours of calls, four submittals waiting") requires transcript capture flowing in without the recruiter typing.

**What is already built:** Google OAuth scaffolding and token storage shipped, scoped to send (commit 3d577d2, `api/google-auth.js`, tokens on the recruiter row, refresh handled). The hard developer-side setup that makes "sign in with Google" work for the user is done.

**What moves up the build order:** expanding scopes to read Gmail, read Calendar, and pull Meet transcripts. This is adding scopes to the existing working flow, not a cold build. Restricted scopes trigger Google's verification review, which takes calendar weeks. So start verification in parallel now, run beta on the test-user allowlist (up to ~100 users sign in with the unverified-app warning, fine for the network beta), and do not gate /wren validation on the review clearing.

**Front door is source-agnostic.** A candidate arrives and Wren accumulates it, whether from a paste, an email, the calendar, a Meet transcript, or eventually a LinkedIn capture surface. Do not hardcode the assumption that candidates enter by paste. Build the door wide so LinkedIn (Phase 2, after the ingestion gate) and OAuth read slot in without a rewrite.

---

## Why this is worth building (the wedge, for POSITIONING)
> Strategic frame. The detail belongs in POSITIONING.md. Captured here so the build remembers what it is for.

- **The $1M solo recruiter is a myth.** They are the face of a 2-3 person team. Solos cap near $500k because that is the operational ceiling of one person. Wren is the team that crosses the ceiling without a hire.
- **Recruiters already overspend on sourcing and underinvest in the close.** $900 LinkedIn Recruiter, $200 Juicebox, $100+ Recruiter Lite. A solo stacks $1,000+/month to find people, then closes on instinct and leftover time. Wren at $499 is the obvious missing line item: the thing that converts the candidates they already pay to find.
- **No guarantee, an honest claim.** Wren does not guarantee a placement, that depends on candidate, client, market, comp. Wren guarantees you stop losing winnable deals to the things you control: forgotten follow-ups, comp not captured at the right moment, a tired 9pm submittal, an A-tier candidate going cold during a four-hour call block. The close runs at top-recruiter level on every candidate every time. Close rate on sourced candidates goes up.
- **The proof and the sales motion are the same activity.** Ryan uses Wren on his own desk, watches his close rate move, then sells it from conviction. Instrument the metric from beta: placements per sourced candidate, or pipeline close rate. That number is both the proof the product works and the pitch to the next user.

---

## What not to build

- Anything that touches sourcing: discovery, net-new candidate finding, outbound at scale. Off-strategy and a dilution of the one thing we have to be best at.
- Team features, shared pipelines, assignments. Solo only, forever.
- New top-level surfaces. The conversation is home. Everything else is a view.
- Anything that asks the recruiter to navigate to it instead of having it surface, or to enter data Wren could capture itself.
