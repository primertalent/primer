# DESIGN.md — Wren Visual System

> The palette and rules below are final. This document is a constraint, not a starting point. If a change violates a rule here, the change is wrong — not the rule.
>
> Read `WREN.md` for product context. Read `VISION.md` for why the product feels the way it feels. This file is how it *looks*.

---

## The argument

Wren is an operator-grade tool dressed in editorial clothing. The product's whole pitch is **sharpness** — the agent tells the truth, names the deal, refuses to soften. The visual system has to match that voice.

That means:

- **Paper-white, not cream.** Warm enough to feel human, cool enough to not feel like artisanal stationery.
- **Sharp corners, not rounded.** Verdict pills are stamped, not tagged. Tables are ledgers, not dashboards.
- **Hairlines, not shadows.** Depth comes from hierarchy and type weight, not drop shadows on content.
- **Editorial typography.** Fraunces for prose and verdicts. JetBrains Mono for labels and data. No system fonts.
- **The wren bird is the only illustrative element.** No icon set. No emoji. No decorative gradients.

If a design choice softens, decorates, or chromes the product — it's wrong. The bird is small, brown, alert, and precise. The product should be too.

---

## Tokens

### Light (default)

```css
--bg:          #faf8f4;              /* paper white — main canvas */
--panel:       #fdfcf8;              /* cards, panels, modals */
--rail:        #f3f1ec;              /* left composer rail, secondary surfaces */
--ink:         #1a1714;              /* primary text, borders at full strength */
--ink-inverse: #faf8f4;             /* text/icons on dark or accent-filled surfaces */
--mute:        #6b655a;              /* secondary text, mono labels */
--hair:        rgba(26,23,20,0.10); /* default 1px borders */
--hair-2:      rgba(26,23,20,0.18); /* emphasized borders, table rules */
--accent:        #b8451f;              /* PROTECT, urgent — the wren's brick-red mark */
--accent-hover:  #3a342e;              /* the only allowed interaction state for --accent */
--win:           #3d6b3d;              /* PUSH, locked, good news */
--kill:          #8a1f1f;              /* KILL — deep brick, used sparingly */
--chip:          rgba(26,23,20,0.05); /* subtle inline chip backgrounds */
```

### Dark (terminal — opt-in via `data-theme="terminal"`)

```css
--bg:            #0c0e0c;
--panel:         #141714;
--rail:          #181b18;
--ink:           #d9d4c7;
--ink-inverse:   #1a1714;
--mute:          #7a7568;
--hair:          rgba(217,212,199,0.10);
--hair-2:        rgba(217,212,199,0.20);
--accent:        #d97757;              /* warmer in the dark */
--accent-hover:  #c46544;
--win:           #6ba36b;
--kill:          #c46060;
--chip:          rgba(217,212,199,0.06);
```

The terminal palette is for power-user moments — late-night deal triage, the "operator desk" mode, screen-share with a candidate where you want the chrome to disappear. It is not the default.

---

## Signal palette

Signal colors are for **taxonomic and categorical labels only** — source type, fit category, screener recommendation, skill status, debrief outcome. They convey classification, not verdict.

**Signal colors are not verdict colors and must never express PUSH / HOLD / KILL / PROTECT.** If a badge means "the deal is at risk" or "this candidate is the one," use a verdict token. If a badge means "this candidate came via referral" or "this screener said advance," use a signal token.

```css
--signal-blue:   #1e40af;   /* inbound, LinkedIn, referral — cold-source types */
--signal-green:  #15803d;   /* advance rec, full skill match, open role status */
--signal-purple: #6b21a8;   /* transcript, calendar, referral type */
--signal-teal:   #0e7490;   /* questions-to-ask-next, neutral data categories */
--signal-amber:  #92400e;   /* hold rec, partial match, on-hold status, caution */
--signal-red:    #dc2626;   /* reject rec, missing skill, hard no */
```

Signal colors are foreground-only. All badges and pills that use signal colors get `--chip` background and `--hair` border — see Rule 7.

---

## Rules (non-negotiable)

These are linting rules. A change that violates one is a defect, regardless of how good it looks in isolation.

### 1. Sharp corners everywhere

`border-radius: 0` is the default. The only exceptions:

- **Circles** — avatars, the bird seal, the hold-to-talk button, status dots.
- **iOS hardware** — the device frame's screen radii (handled by the `ios-frame` component).

Do not add 4px / 6px / 8px radii to "soften" anything. Verdict pills are **stamped**, not tagged. Cards are **paper**, not pillows. If a corner feels too aggressive, the answer is more whitespace, not a radius.

### 2. Shadows on floating surfaces only

`box-shadow` is allowed only on surfaces that **overlay the canvas** — surfaces that float above the main layer and need a shadow to establish their plane:

- Modals
- Dropdown menus
- Popovers and overflow menus
- The slide-in deal panel
- The floating composer / agent response bar
- The sticky Deal Status Bar (it pins over scrolling content)

`box-shadow` is **not allowed** for:

- **Hover decoration on inline cards.** Hover lift = `background: var(--chip)`. No shadow.
- **Input focus states.** Focus = `outline: none; border: 2px solid var(--ink)`. No glow.
- Any other surface that doesn't overlay the canvas.

Depth comes from surface tone (`--panel` over `--bg`), hairline borders, type hierarchy, and whitespace — not drop shadows on content.

### 3. Verdict colors are reserved

The four verdict colors carry meaning. They are not decoration.

| Token | Verdict | When to use |
|---|---|---|
| `--accent` (brick) | **PROTECT** | The deal is at risk. The candidate has leverage. The window is closing. |
| `--win` (hedge) | **PUSH** | The deal is moving forward. Locked outcomes. Good news. |
| `--kill` (deep brick) | **KILL** | Walk away. Used sparingly — most "no" decisions are HOLD, not KILL. |
| `--ink` (full strength) | **HOLD** | Default. Watching, not flagging. |

Do **not** use these colors for:

- Hover states (use `--chip` or a 1-shade ink tint)
- Links (links are `--ink` underlined, or `--accent` only when the link *is* the verdict)
- Decoration, ornament, or "to add color"
- Categorical labels — use signal tokens instead

If a UI element doesn't represent a verdict, it doesn't get a verdict color.

### 4. Typography roles

- **Fraunces** (serif) — all prose. The Wren Read. Verdict explanations. Headings. Italic for editorial commentary ("i'm more cautious," "we agree"). Use `opsz` axis: 144 for display sizes, 14 for text.
- **JetBrains Mono** — labels, data, timestamps, fees, counts, table headers. Always 10–12px, `text-transform: uppercase`, `letter-spacing: 0.14em` for labels. 13–14px sentence-case for data values.
- **System serif fallback** — Georgia. The system sans (`Söhne`, `Inter`) is only used for chrome/UI strings under 13px where Fraunces feels too literary.

Mono is **never** used for prose. Prose is **never** uppercased.

### 5. No decorative gradients, no emoji, no stock iconography

- **No gradients on content surfaces.** Not on backgrounds, buttons, chips, cards, panels, or decoration. Flat color or hairline border. **Exception:** loading skeletons may use a single horizontal shimmer gradient (`linear-gradient(90deg, ...)`) and nothing else.
- **No emoji.** Not in copy, not in labels, not in empty states.
- **No icon library.** No Lucide, Feather, Heroicons, Phosphor. The wren bird is the only illustrative element. If a glyph is genuinely needed (search, close, chevron), draw it inline as a 1.5px-stroke SVG in `currentColor`, no fill.

### 6. Urgency is two states, not three

Temporal urgency uses exactly two colors:

- **Overdue and today:** `--accent` (brick red). Something needs action right now.
- **Everything else:** `--ink` (default). Watching. Not flagging.

Do not introduce a third urgency color (amber, orange, yellow) for "soon" or "this week." If it's not urgent today, it is default ink. The distinction is binary: needs action now, or doesn't.

### 7. Badges and pills are chip + hair

All badges and pills use `--chip` as their background and a 1px `--hair` border. Meaning is carried entirely by the foreground color — `--ink` for neutral, a verdict color for deal state, or a `--signal-*` color for taxonomic category.

Do not introduce per-color tinted backgrounds. There is no purple badge background, no green badge background, no red badge background. The neutral chip surface is what all badges share; the text color is what differentiates them.

This applies universally: source badges, fit badges, screener-rec badges, skill-status badges, debrief outcome badges, debrief signal badges, risk pills, wren-chip types.

### 8. The bird

The wren bird mark (`wren-bird-mark.png`) is the brand. Treat it like a stamp:

- It is always a single color — `--ink` on light, `--ink` on dark (the bird inverts with the theme via CSS filter).
- It does not animate as decoration. It can move when it has something to say (lands on a deal that needs attention; perches on the lock screen when there's a notification).
- It is not a logo lockup. It does not have a tagline. It does not get a wordmark next to it except in the masthead, where the Fraunces "Wren" sits beside it at 1.5× the bird's height.

---

## Surfaces and where to use them

| Surface | Token | Where |
|---|---|---|
| Canvas | `--bg` | Page background. The desk. |
| Panel | `--panel` | Cards, the deal-detail panel, modal overlays, action items in the tray. |
| Rail | `--rail` | The 56px composer rail on the left. Onboarding sidebars. Anything secondary that needs to recede without disappearing. |
| Chip | `--chip` | Inline pill backgrounds for non-verdict metadata (timestamps, source tags). Hover-state fills on cards and rows. |

Three surface tones is the budget. Don't introduce a fourth ("slightly darker panel for emphasis"). If you need emphasis, use `--hair-2` or type weight.

---

## Spacing and density

The system uses an 8px base, but the operator desk runs **dense**: 14px row gaps in tables, 18px between cards, 32px between sections. This is intentional. Recruiters read this product the way traders read a terminal — at a glance, full screen, lots of named entities. Do not "open it up for breathing room." The breathing room is the paper-white background.

| Context | Vertical rhythm |
|---|---|
| Inline labels above values | 4px |
| Within a card | 8–12px |
| Between cards in a list | 14–18px |
| Between sections | 32–40px |
| Page padding (desk) | 40px top, 56px sides |

---

## Lint pass — when the design drifts

Run this checklist any time the codebase changes. Each item is greppable.

- [ ] No `border-radius` value > 0 outside `circle`, `avatar`, `hold-to-talk`, `ios-frame`.
- [ ] `box-shadow` only on: modal, dropdown, popover, slide-in panel, floating composer/response bar, sticky Deal Status Bar. Not on inline card hover or input focus.
- [ ] Input focus = `border: 2px solid var(--ink)` — no `box-shadow`.
- [ ] Hover on inline cards = `background: var(--chip)` — no `box-shadow`.
- [ ] No use of `--accent`, `--win`, or `--kill` outside verdict contexts.
- [ ] No use of signal tokens (`--signal-*`) in verdict contexts.
- [ ] No `linear-gradient` or `radial-gradient` outside `.skeleton` loading classes.
- [ ] No emoji codepoints in source.
- [ ] No imports from `lucide-react`, `react-icons`, `@heroicons/*`, `phosphor-react`, or similar.
- [ ] No hardcoded hex colors outside the token tables above. Search for `#` followed by 3 or 6 hex digits.
- [ ] All prose uses Fraunces. All labels use JetBrains Mono uppercase.
- [ ] Old cream values are gone: `#f5f1e8`, `#fbf8f0`, `#efe9dc`, `#f0eee9`.
- [ ] Urgency overdue/today = `--accent`. Everything else = `--ink`. No third urgency color.
- [ ] No custom property named `--*-bg` (except `--bg` itself) or `--*-border` — grep `--[a-z].*-bg:` and `--[a-z].*-border:` in `:root` blocks.
- [ ] No custom property named `--color-*` — the old token prefix is fully retired.

If a violation exists, fix the violation. Do not relax the rule.

---

## What this system is not

- It is **not** a generic design system. It exists for one product made by one team. Don't extract it into a library.
- It is **not** a brand guideline. It's a working constraint document for the operator surface. Marketing pages, decks, and the website may diverge — but they should diverge *upward into more editorial*, not downward into more SaaS.
- It is **not** finished. When a real product decision forces a new token (a third theme, a notification color), add it here with a one-line justification. Do not add tokens speculatively.

---

*Last updated: May 2026. Owner: design.*
