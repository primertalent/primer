# End-of-Day Brain Dump — Mode 3 Worked Example

**Surface:** Phone or desktop (voice or text)
**Demonstrates:** Highest-density capture per second of recruiter input, Mode 3 parsing requirements, why this becomes the demo lead
**Tags:** `mode-3`, `raw-dump`, `multi-intent`, `demo-hero`

This is the Mode 3 raw dump pattern — the relationship pattern that makes Wren a destination for the recruiter's thinking, not just structured commands.

---

## The scenario

**Recruiter speaks or types (60-90 seconds):**

> "Talked to Sarah today, she's amazing, would be great at the Anthropic role we're going to launch next month, also she mentioned her friend from Stripe might be looking, didn't get the name though, going to follow up. Oh and Mike from yesterday is a hard pass, his references came back terrible."

---

## What Wren must parse

**Six structured outputs from one dump:**

1. **Tier rating for Sarah:** Interaction logged, tier signal extracted from "she's amazing." Proposed tier update surfaced to recruiter for confirmation.

2. **Future role-to-candidate prediction:** Sarah flagged as a potential match for the Anthropic role that hasn't launched yet. Stored as a forward-looking match signal, not a pipeline entry — the role doesn't exist yet. Surfaces when the Anthropic role is created.

3. **Referral hint (incomplete):** Sarah mentioned a friend from Stripe who might be looking. Name unknown — recruiter flagged to follow up. Action created: "Ask Sarah for her Stripe contact's name." Not a candidate record yet. A pending referral chain entry.

4. **Follow-up action:** Follow up with Sarah about the Stripe contact. Queued as a scheduled outreach in the next 2-3 days.

5. **Elimination for Mike:** Mike eliminated. Source: "hard pass, references came back terrible."

6. **Elimination reason and severity:** References came back terrible → severity escalation from standard pass. Stored with reason. Surfaces on any future encounter with Mike.

---

## What this demonstrates

- **Highest-density capture per second:** Six structured work outputs from a 15-second spoken thought. No recruiter typing. No form navigation. No explicit command structure.
- **Mode 3 parsing requirements:** Multi-intent, multi-entity, incomplete information, forward-looking signals, and mixed tone all in one utterance. The parser must handle each cleanly without asking the recruiter to rephrase.
- **Why this becomes the demo lead:** The demo moment is not "look at this dashboard." The demo moment is: recruiter speaks for 15 seconds, Wren shows six things it captured. Every recruiter watching says "I lose this information every day." That's the conversion.

---

## Build implication

Mode 3 parsing is the highest-leverage V2 capability. It requires:
- Named entity extraction (Sarah, Mike, Anthropic, Stripe)
- Intent classification per entity (tier signal, future match, referral hint, elimination)
- Confidence thresholds per extracted item (high confidence → auto-write; uncertain → propose with one-tap confirm)
- Incomplete information handling (Stripe contact unknown → action created to retrieve it, not a stub candidate record)
- Free-form residue (anything that doesn't map to structured state → note attached to the relevant candidate or role)

The canonical trigger for this pattern is end-of-day: recruiter offloads everything in 60-120 seconds, Wren absorbs and structures, recruiter walks away with the work staged. Not a new workflow. A natural conversation Wren can now capture.
