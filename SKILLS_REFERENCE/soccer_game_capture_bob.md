# Soccer Game Capture — Bob

**Surface:** Phone (PWA)
**Demonstrates:** Voice-native multi-intent parsing, agent shape capture, mobile-first leverage, cognitive offload
**Tags:** `capture-surface`, `voice-input`, `soccer-game-test`, `multi-intent`

This is the V2 hero demo scenario. The soccer game test in its canonical form — not a staged demo, but an actual use pattern Wren must handle.

---

## The scenario

**Context:** Recruiter is at their kid's soccer game. They glance at a text from Bob. They cannot type. They have 8 seconds.

**Recruiter opens Wren and speaks:**

> "Bob just texted, he's onto the 3rd step with X company, still need to schedule a debrief, confirm next step date and times, and Bob needs fresh prep materials."

**What Wren must parse from this single utterance:**

1. **Entity identification:** Bob → candidate. X company → client/role match.
2. **State change:** Bob has advanced to the 3rd step in the process. Stage advance written to pipeline.
3. **Action 1:** Schedule a debrief with Bob. Created as a scheduling action in the queue.
4. **Action 2:** Confirm next step date and times with X company. Created as a client check-in action.
5. **Action 3:** Generate and send prep materials to Bob before his next step. Draft generated, queued for approval.

**Wren's response (voice or push):**

> "Got it. Bob advanced to step 3 at X Company. Debrief scheduled, next-step check-in queued for X Company, and prep email drafted — ready when you are."

**Recruiter does not type anything. Recruiter closes the app.**

---

## What this demonstrates

- **Voice-native multi-intent parsing:** One utterance, five structured outputs. The recruiter does not formulate separate commands. They speak the way they'd describe the situation to a colleague.
- **Agent shape capture:** The recruiter's job is to surface the signal. Wren's job is to handle translation, entity matching, state writes, and action queuing.
- **Mobile-first leverage:** The entire interaction happens on a phone in under 10 seconds. No typing. No navigation. No form.
- **Cognitive offload:** The recruiter does not need to remember to do anything. They offloaded five work items in 8 seconds and returned to the soccer game.

---

## Build implication

This scenario drives the Mode 3 parsing requirement and the voice capture architecture for Phase 3. The parsing model must handle:
- Entity resolution from context (Bob → which Bob? Match against active pipeline)
- Intent decomposition (one utterance → multiple structured actions)
- Confidence thresholds (high confidence → auto-write; ambiguous → confirmation required)
- Free-form residue (anything that doesn't parse cleanly → note attached to the relevant candidate)

The prep email is not sent automatically. It is queued as a draft for one-tap approval on the Desk. Stage advance and scheduling actions at high confidence write without confirmation.
