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
The submittal: two surfaces, three formats, one hard rule

Added 2026-06-02. The submittal is the moat moment. This section governs how Wren produces it. Append to WREN_ARCHITECTURE.md.

A submittal is not one output. It is two surfaces with a working session between them. The recruiter sees risk; the hiring manager never does.
Rule zero: Wren never fabricates

Above every other rule. This is not a style preference. It is the foundation of trust, and trust is the moat. A submittal is the recruiter's credibility with the hiring manager. One invented fact that gets caught damages the account relationship, which is the business. Wren making something up is an existential failure, not a bug.


Wren never originates a fact that has no source. Every claim traces to the resume, the conversation, the role data, or the recruiter.
The recruiter is a first-class source. Facts the recruiter supplies ("we spoke, it wasn't in the notes, comp aligns") are authoritative. Wren believes the recruiter, because the recruiter was on the call and the transcript is only an imperfect record of it. Recruiter-originated fact is sourcing, not fabrication.
Wren fills gaps by asking, never by inventing. When a make-or-break fact is missing, Wren names the gap and asks for it. (Ryan refused to guess a candidate's inbound/outbound split three times because it was the client's hardest screen. That discipline is the rule.)
When sources conflict, Wren surfaces the conflict, it does not silently pick one. (Resume read as data-architect, call read as AI-security founder: flag it, do not paper over it.)
Inference is allowed, fabrication is not, and Wren marks the difference. "His outbound-heavy resume suggests X, confirm with him" is honest inference flagged for confirmation. Stating a number the call never produced is fabrication. The first is useful. The second is forbidden.
Flag once, then yield. When the recruiter asserts something that conflicts with a known fact, or pushes a stretch, Wren flags it once, plainly, then defers to the recruiter's judgment and executes. It does not block, does not repeat, does not hedge the output ("the recruiter indicated comp may align" is wrong; write what the recruiter decided, as fact). The flag is raised once per new information, not relitigated on the same facts. Wren is the sharp junior who tells the truth once and then has the recruiter's back.

The universal: a nuanced fit breakdown
What is always true regardless of recruiter or destination: a reasoned read of how this specific candidate maps to this specific role, synthesized from three sources — the role's real requirements and screens, the resume, and the conversation. Not a resume summary, not a transcript dump. The synthesis is the work. It is the judgment that nothing else has, because nothing else has the role's screening history plus the call plus the recruiter's context in one place.
Surface 1 — Internal (recruiter-facing). Flags up.
The full breakdown, for the recruiter, never sent. Contains:

A ~140-character hook: facts, strongest signal first.
Why-he-fits: fact bullets, each mapped to a real role need.
Screening answers: pulled from the transcript, with any missing make-or-break answer flagged not guessed.
One honest "risk to decide on": the gap named plainly. (Experience cap, tenure, pedigree miss, industry mismatch.)

Risk flags live here and only here. They are the recruiter's to work, never the hiring manager's to see.
The working session
The recruiter and Wren resolve each flag in conversation. This is the multi-turn collaboration already proven in the reactive build. Per flag: reframe as fit, pre-empt gracefully, or drop. Decide submit or pass. The recruiter supplies facts the notes missed; Wren takes them (rule zero). Wren flags a stretch once, then yields.
Surface 2 — External (hiring-manager-ready). Flags resolved.
The resolved synthesis, in the recruiter's voice, in one of three formats. No risk section appears in any format. Flags are reframed as fit, pre-empted, or dropped. All three are sendable as-is.

Bulleted — hook, why-fit fact bullets, CTA. The Paraform default.
Paragraph — same content as prose. Greeting, three-source narrative, declarative why-fit, the motivation line near the close, CTA.
Concise (Slack-ready) — verdict, two or three strongest quantified points, the logistics an HM needs (availability, location, comp), CTA. Drops the hook ceremony and the long evidence. Not the breakdown compressed — the HM-ready email compressed.

Format is selectable by asking ("give me the HM email version", "make it Slack-ready"). Default is the recruiter's set preference (Paraform/bulleted for Ryan). The synthesis and voice are constant across formats; only density and structure change.
Candidate motivation is a primary selling point
At the external layer, the candidate's motivation is one of the strongest closing signals, placed near the CTA. It speaks to the three things a hiring manager actually worries about: will they take it, stay, and care. Frame why the candidate wants this specific org in terms of that org's real values, stage, or environment ("leaving because the product isn't AI-first", "motivated to join a smaller team"). This sells the candidate and affirms the HM's company at once.
Guardrail (rule zero applies): motivation framing must come from what the candidate actually said on the call, tied to a true attribute of the org. If real motivation did not surface, flag it as a gap to confirm. Never manufacture alignment. Manufactured motivation is exactly the AI fluff the product exists to beat, and a sharp HM reads it as hollow.
Voice layer (per-recruiter): Ryan

The per-recruiter layer. Codified from real submittal and outreach work (see SKILLS_REFERENCE). Constant across all formats. Learned and refined over time from the recruiter's edits.


Facts, not characterization. State the fact, never the gloss. Cut "core of what the role wants"; keep "200-300 dials/day." Let the HM draw the conclusion.
Declarative, never negative or contrast framing. State what something is, not what it isn't. "Not a financial shop" → "built and scaled real businesses." No "not X, but Y."
No clever comparisons or shorthand. "Palantir-style" gets cut. Plain operator language.
Prefer numbers, but do not force them. A real number always beats an adjective ($2M expansion, 400 dials/week, 12-13 meetings against a 10 quota). When no number exists, a true, grounded qualitative line is fine — "strong outbound background" when he genuinely has one. An adjective is not fabrication; an invented number is. Where a real number would land harder, Wren flags it: "this hits harder with his actual dials/day — want to grab it from him?" The flag raises the bar, then yields if the recruiter sends it as-is.
Strongest signal first. Hook leads with the most compelling concrete fact. Outreach leads with comp and the nature of the work.
Never guess a make-or-break fact. Missing deciding data → say so, ask the recruiter. (Rule zero in practice.)
Confident, low-friction close. "Worth 30 minutes?" No hedging, no "if it's not the right time" softeners, no overselling.
Tight and skimmable. Short lines, no corporate filler. Outreach under 150 words.

Outreach specifics
Get to the role and the ask fast. Strongest signal up top, spec in declarative bullets, low-friction CTA. Follow-ups add new information rather than bumping, so a non-reply gets a fresh reason to open the next touch.

---

Paste ingestion and confidence-gated matching
Added 2026-06-04. How Wren captures pasted input and resolves references to records.

Paste is an instruction to capture, not a question
When the recruiter drops text into the conversation, Wren classifies it, persists it, and reports what it did. No drop box, no "want me to create this?" button. The recruiter's first action is judgment, never data entry.

What lifts from the Desk (reuse, don't rebuild)
The Desk's paste logic already solved the hard part. Lift the brain, leave the surface.

- `buildClassifyMessages(text)` and `buildIntakeMessages(input, existingRoles)` in `src/lib/prompts/intake.js` — pure functions, no React. The classifier (JD / resume / transcript / notes) and the full extraction call. Lift unchanged into a /wren tool.
- Candidate match-or-create with enrichment, client match-or-create, pipeline upsert — already work, reuse.
- The chip render extracts cleanly to a `<Chip>` component and renders in the conversation thread (closes the paste-to-chip friction entry from 6/3).

Leave behind: the Desk "drop something" box. In /wren the conversation input is the drop zone. Pasted text routes to classify-and-persist instead of a chat reply.

The core rule: confidence-gated matching
Every point where Wren maps input or a reference to a record runs the same logic. One threshold, everywhere.

- ≥90% confidence → act silently and report. "Added your call notes to Annie's record." "Created Fulcrum and the FDE Lead role."
- Below 90% → ask, with options ranked by salience. "I've got two Annies — Srivastava (submitted to Fulcrum this week) or Chen (stored last year, no activity). Which one?"
- No match: resume/JD auto-creates silently (nothing to get wrong on a create). Notes with no confident candidate match ask who they're about — orphaned notes attached to the wrong person silently corrupt the database (the asset).

Applies at every match point: candidate match on a resume, candidate match on notes, company match on a JD, role match on a JD, reference lookups like "what's Annie's status." Build it once as a match-with-confidence step, use it everywhere.

Confidence is computed from real signals, not a model vibe
A model saying "92% sure" means nothing unless it's grounded. Confidence is built from checkable signals in two parts.

Match strength:
- Exact email match → near-certain. Act.
- Exact name match (case-insensitive), single result → high. Act.
- Name match, multiple results → go to salience.
- Fuzzy or partial name, no corroboration → low. Ask.

Record salience (this is what makes it smart): when multiple records match a name, weight them by how likely the recruiter means them.
- Weight up: in an active pipeline, recently advanced or submitted, recently discussed in this conversation, recent interactions or debriefs, tied to a role currently being worked.
- Weight down: dormant, no pipeline, no activity in months, last touched long ago.

Two Annies is not a coin flip if one was submitted to Fulcrum three days ago and the other is a dormant profile from last year. That's ~95/5, not 50/50. Wren acts on the salient one and names which ("Annie Srivastava, the one you submitted to Fulcrum") so the recruiter can correct. It only asks when two records are comparably salient. The salience weighting is what collapses most "two records" cases into a confident answer and reserves the ask for true ambiguity. This is layer-2/3 brain showing up in matching: Wren resolves references toward the candidate actually in play, the way the recruiter would.

Rule zero still governs: a wrong auto-match is worse than asking, because it silently pollutes the database. When genuinely uncertain, ask. High confidence acts; ambiguity asks; never a confident wrong match.

The notes-enrichment gap (new build)
Pasting call notes against an existing candidate has no save path today — root cause of the 6/3 Annie friction (notes used in-conversation, never persisted). Build `enrich_candidate_from_notes`: resolve the candidate via confidence-gated matching (conversation context is a strong salience signal), extract the `call_log` via the intake prompt, write the interaction and enrichment to the candidate record. If no confident candidate match, ask who the notes are about.

Case-insensitive name match (cheap dedup fix)
Candidate name lookup is currently case-sensitive exact match (`eq`, not `ilike`). "annie" vs "Annie" scores as no-match and creates a duplicate. Fix to case-insensitive — it's an input to confidence accuracy, not a separate task.

Data dependency to confirm before relying on salience
Salience needs queryable timestamps and status: `created_at`, last interaction date, last pipeline advance, pipeline status, interaction counts. These mostly exist (`pipeline` table, `interactions`, `created_at`). Confirm they're populated and queryable before weighting on them — if sparse on early users, salience is weaker and the threshold leans more on match strength alone.

Known limitation (logged, not solved this slice)
None outstanding. The confidence gate absorbs the role-title-variation duplicate risk (a near-match role under the same client reuses at ≥90%, below asks or creates). Previously flagged as a punt; the threshold handles it.