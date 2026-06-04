# WORKFLOW.md

How Ryan and Claude Code work together. Patterns that compound. Adjust deliberately, not in the moment.

---

## Session startup

**Read Tier 1 only at session start. Pull Tier 2 on demand.**

**Tier 1 (read every session):** WREN.md, VISION.md, DECISIONS.md. The Current State TL;DR at the top of WREN.md (40-60 lines) is sufficient for most sessions.

**Tier 2 (pull on demand):** POSITIONING.md, COLLISION_AUDIT.md, FRICTION.md, FRICTION_2026_04_audit.md, FEEDBACK.md, WORKFLOW.md, SKILLS_REFERENCE/. Read when the session touches their domain. Do not read all at startup.

**DESIGN.md is Tier 1 for any session that creates or changes UI.** Pure backend slices (api/, prompts, DB, agent loop) keep it Tier 2. Any session that touches a component, a CSS class, or any visual output reads DESIGN.md at startup alongside WREN.md.

Maintainer note: update the TL;DR after every session that ships work. Treat it like a build-status dashboard.

---

## Design conformance gate (UI slices)

**Any build prompt or session that creates or modifies UI must read DESIGN.md and run its lint-pass checklist before committing.** Design conformance is a commit gate for UI slices, alongside correctness.

Greppable lint checks to run before every UI commit:
- `border-radius` not equal to `0` outside the three allowed exceptions (circular elements, `--radius-pill`, avatar/spinner)
- `box-shadow` outside of the two permitted floating surfaces (tooltips, modals)
- Emoji codepoints in JSX or CSS (replace with 1.5px-stroke SVG glyphs per DESIGN.md rule 5)
- Icon library imports (`lucide-react`, `heroicons`, `feather`, etc.) — not permitted
- Hardcoded hex values not in the DESIGN.md token table
- `prose` elements using Inter or system font instead of Fraunces
- Operator labels (timestamps, codes, urgency headers) using anything other than JetBrains Mono
- Retired cream values (`#fdf6e3`, `#f5f0e8`, `#fefcf7`, or similar off-whites) — replaced by `--color-surface`
- Third urgency color — only `win` (green) and `accent` (red) are token-backed; do not add a third
- Non-token property names (`--color-*`, `--*-bg`, `--*-surface` outside the canonical token list)

If a violation would break working functionality, flag it explicitly for deliberate decision — do not silently fix it.

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

- **WREN.md** — build state, tech debt, V2 build targets. Updated continuously.
- **DECISIONS.md** — standing architectural and product decisions. Append-only. New decisions go at the top.
- **One fact, one file.** Where POSITIONING.md references pricing or ICP, it points to VISION.md rather than restating. Pricing ($499/$199 beta) and ICP one-liner live in VISION.md.
- **VISION.md** — founder bet, operating principles. Updated rarely.
- **POSITIONING.md** — GTM, ICP, pricing. Updated rarely.
- **DESIGN.md** — visual system, lint rules. Non-negotiable.
- **COLLISION_AUDIT.md** — known frictions, Phase 2 backlog. Frozen reference.
- **FRICTION.md** — live log of real-use friction. Append-only, newest at top.
- **FEEDBACK.md** — customer voice verbatims. Append-only.
- **SKILLS_REFERENCE/** — worked examples of senior recruiter judgment that future Wren features will codify.
- **WORKFLOW.md** — this file. Working-with-Claude-Code patterns.
