# WORKFLOW.md

How Ryan and Claude Code work together. Patterns that compound. Adjust deliberately, not in the moment.

---

## Session startup

Every Claude Code session begins by reading every .md file in the repo root plus SKILLS_REFERENCE/. This burns real context window before any code work begins. Mitigation:

**Current State TL;DR at the top of WREN.md.** 40-60 lines that capture what's shipped recently, what's actively broken, what's next. Sufficient context for routine sessions. Full docs remain for sessions that need deeper context.

Maintainer note: update the TL;DR after every session that ships work. Treat it like a build-status dashboard.

---

## Gate pattern

Code changes go through the full gate: diagnosis → plan → gate → diff → review → commit → push.

Docs-only changes (FRICTION.md, CHANGELOG.md, FEEDBACK.md, WREN.md updates, SKILLS_REFERENCE/ additions, WORKFLOW.md itself) go through a lighter gate:

- Claude Code outputs a change summary, not the full diff
- Ryan confirms with a one-word approval ("approved" or "yes")
- Claude Code commits and pushes in one step

The lighter gate preserves the awareness moment without the full diff review cost. Never skip the gate entirely — even docs commits affect what future sessions read as ground truth.

---

## Deferral discipline

Deferred items are not free. Each one lives in WREN.md, COLLISION_AUDIT.md, FRICTION.md, and in working memory. Deferred items compound cognitive load on every session that touches related surface area.

**Weekly deferral audit.** Once a week, review every deferred item. Three options per item, no "defer again" allowed:

1. Ship it now (if real and small enough)
2. Queue it as the next focused session (if real and big enough)
3. Delete the entry (if not actually important)

If an item has been deferred 3+ times, default to delete unless there's an active reason to keep it.

---

## Infrastructure decisions

Vercel Hobby is the current host. The 10s function timeout is a real constraint and has already cost one debug session (May 21 agent loop fix).

Decision rule: if any function (not just agent loop) times out again on Hobby, upgrade to Vercel Pro. Do not re-debate. $20/month is trivial relative to the cost of debugging infrastructure constraints.

---

## What gets captured where

- **WREN.md** — build state, tech debt, decisions log, V2 build targets. Updated continuously.
- **VISION.md** — founder bet, operating principles. Updated rarely.
- **POSITIONING.md** — GTM, ICP, pricing. Updated rarely.
- **DESIGN.md** — visual system, lint rules. Non-negotiable.
- **COLLISION_AUDIT.md** — known frictions, Phase 2 backlog. Frozen reference.
- **FRICTION.md** — live log of real-use friction. Append-only, newest at top.
- **FEEDBACK.md** — customer voice verbatims. Append-only.
- **SKILLS_REFERENCE/** — worked examples of senior recruiter judgment that future Wren features will codify.
- **WORKFLOW.md** — this file. Working-with-Claude-Code patterns.
