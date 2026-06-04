# FEEDBACK.md

Customer voice quotes from real use, captured verbatim. Ryan as ICP is the primary source until external beta users exist.

Format: `Date | Source | Quote | Context`

---

## June 4, 2026 — Ryan (Annie/Fulcrum session, post-pipeline fix)

> "Wren showed situational awareness / economy of effort. Asked to screen Annie when the screen was already run this turn, it declined to redo it: 'already ran it, results above, 7/10 advance, ready to draft?' Didn't waste a tool call or repeat work. This is the cross-turn memory fix surfacing as judgment — knowing when NOT to act, not just acting with conviction. The 'smart as hell' requirement showing up as restraint. Felt like an employee who remembers what just happened, not a tool re-executing input."

Context: Wren was asked to screen Annie against Fulcrum after the screen had already run in the same conversation turn. Rather than re-running the tool, it cited the result already in context and moved forward. This is the cross-turn memory fix (commit 2743df3, tool results persisting across turns) showing up as agent-shaped behavior — Wren uses what it knows instead of re-executing. The "smart as hell when you work together" quality from VISION showing up specifically as restraint and economy, not just capability.

---

## May 13, 2026 — Ryan (daily use, strategic session)

> "I don't want Wren to feel like a task creator, where we are doing things just to satisfy it and not what actually matters."

Context: Reaction to SaaS-shaped action cards that ask the recruiter to perform steps rather than approve what Wren already drafted. Drove the card shape principle.

---

> "You doing what you normally do as a recruiter, getting help with every step, and being provided insane insights along the way."

Context: Describing the ideal Wren experience — ambient, not directive. Wren is in the background making the recruiter better, not adding a new workflow layer.

---

> "A submittal is a high leverage moment that we shouldn't be doing at a soccer game. We may want to iterate this and edit this a few times back and forth with Wren before we send to a client. But candidate communication is. Getting them more info is."

Context: Distinguishing which send moments need desk-level review vs. which can be phone-native one-tap. Submittals are considered sends. Candidate status updates and info shares are routine sends. Shapes the email autonomy tiering.

---

> "In time, most will just let fly and reply automatically in high confidence situations. But until it's widely accepted, I want human in the loop to be in place. But for power users, we can have Wren auto reply if they are comfortable."

Context: On the path from default approval-required to earned autonomy. Default is human in the loop. Trust is demonstrated over time and explicit preference. Some moments stay gated regardless.

---

## June 3, 2026 — Ryan (Annie/Fulcrum — second real-candidate session, moat confirmed)

> "Logic comparing candidate to JD was mostly strong. On a real candidate (Annie/Fulcrum), preferred Wren's submittal work to Claude Code's on the same task. Mid-conversation call-note enrichment folded in correctly — resolved the make-or-break coding-depth question while honestly refusing to oversell it ('connected systems and integrations, don't oversell as core engineering'). Client-objection pattern (avoid consulting/legacy pedigree) surfaced and carried into the reframe."

Context: Full screen-to-submittal run on Annie against a Fulcrum role, with mid-conversation call-note enrichment. Wren beat a direct Claude Code comparison on synthesis, client-objection pattern application, and honest depth-of-coding read. Moat behavior confirmed — substance is working. Issues surfaced were surface and capture: ingestion not persisting pasted data, format choice dropped, one rule-zero pedigree miss, and render formatting rough. None undermine the core output quality.

---

## June 3, 2026 — Ryan (first real-candidate test of voice + two-surface submittal)

> "The two-surface submittal model worked end to end on a real candidate. Internal breakdown with flags up, working-session transition, external HM-ready version with risk section dropped. Voice landed, facts-first, declarative, quantified, clean close, matches the gold-standard examples. Motivation guard fired correctly ([NEEDS] instead of invented alignment). Risk resolution and reframe behaved as designed. Three correctness bugs surfaced (logged in FRICTION) but the architecture and voice are confirmed."

Context: First real use of the voice layer and internal/external surface split against a live candidate (Nick Bulow, Unit SDR role). The architecture passed: two-surface model behaved as designed, voice rules produced facts-first declarative output matching the gold standard, motivation guard held (did not fabricate alignment, flagged the gap). Three quality bugs surfaced in the same session (screen self-contradiction, motivation data not flowing from record to draft, search path failure on first entry). Architecture confirmed; correctness bugs queued.

---

## May 14, 2026 — Ryan (morning brain dump session)

> "We will lose our users if wren isn't able to adjust with live feedback. They will either think wren got it right, or got it wrong. If they feel like it's wrong, with no way to push back and iterate, we lose them."

Context: On the necessity of Wren's deference principle — the agent must execute recruiter direction and iterate, not resist. Drove the "Wren defers to recruiter judgment. Always." operating principle in VISION.md.

---

> "I don't want wren to feel like a task creator, where we are doing things just to satisfy it and not what actually matters."

Context: Reinforcement of the card shape principle from May 13. Agent-shaped cards drive recruiter judgment on real work. SaaS-shaped cards create busywork. The distinction is the product.

---

> "Your LinkedIn network isn't the best for wren. We don't need 10,000 duds. Rather have 100 great profiles."

Context: On onboarding data sources. Gmail and Calendar surface interaction-rich relationships. LinkedIn exports surface surface-level connections. Quality over volume as a design constraint — not just a marketing line. Drove the "Quality over volume" ICP addition in POSITIONING.md.

---

> "A human brain can only remember and handle so much, especially when the most important thing is closing the next candidate. Especially when we think sourcing will be commoditized and this intelligence layer will matter the most."

Context: On the compounding value of the memory layer when sourcing becomes free. Recruiter cognitive capacity is finite. The intelligence layer's job is to extend that capacity at the moments that matter.

---

> "The recruiter is still the best data source. The easier we make it to pull from their brain into Wren, the better we become."

Context: On Mode 3 raw dump as the highest-leverage capture pattern. The recruiter holds the signal. Wren's job is to reduce capture friction to near zero so that signal flows in constantly and compounds over time.
