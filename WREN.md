# WREN — Master Context Document
> Read this at the start of every Claude Code session. Keep it current. Last updated: 2026-04-14 (session 3).

---

## What is Wren

Wren is an AI-native OS for solo independent recruiters. Built by Ryan McGuinness, solo recruiter at Primer Talent LLC. Lives at hirewren.com.

Not a co-pilot. Not a chatbot. An operating system that handles the work between human touchpoints so the recruiter can focus on the relationships that close deals.

**The model:** Human first, AI in the middle, human last. Recruiter opens their day with a brief, works their roles, closes with a queue of actions to review. AI fills everything in between.

---

## Stack

| Layer | Tool |
|---|---|
| Frontend | React + Vite |
| Database + Auth | Supabase |
| Hosting | Vercel |
| AI | Anthropic API — claude-sonnet-4-6 |
| Serverless | api/ai.js (Vercel serverless functions) |

- Repo: github.com/primertalent/primer
- Live: primer-rosy-two.vercel.app
- Local: C:/Users/Ryan McGuinness/primer
- Run locally: `cd ~/primer && claude`
- Dev server: http://localhost:5173 (sometimes 5175)
- ANTHROPIC_API_KEY is server-side only, never exposed to client

---

## What's Built and Working

- Auth (Supabase)
- Morning brief with clickable stat cards
- Candidate database table — sort, filter, fit score badges
- Candidate card — AI next action, resume screener, career timeline, tenure summary, signal badges, scores history
- CV upload — full text extraction (PDF + DOCX), cv_text saved to candidates table
- Candidate edit page at /candidates/:id/edit
- Role setup — JD scraper (paste URL or upload PDF)
- Role detail — kanban pipeline board + JD display
- One-click stage advance on kanban cards (no page nav required)
- Client list and client detail with contacts
- Approve and send queue
- Delete on all records with confirmation modals
- Back navigation goes to logical parent (not browser history)
- Nav order: Brief → Clients → Roles → Candidates → Queue
- Career timeline saves to `career_timeline` JSONB column on candidates table
- Career signals save to `career_signals` JSONB column on candidates table
- Screener fit score saves to `pipeline` table after screening
- **Candidate submission drafting** — ✉ button on each kanban card in RoleDetail. Fetches full candidate record, calls AI with JD context. Modal with Email/Bullet format toggle, editable textarea, Save to Queue or Copy. Saved drafts appear in /queue as status: drafted.
- **Bidirectional pipeline movement** — ← and → buttons on every kanban card. ← only appears when there's a previous stage, → only when there's a next. Optimistic UI with rollback on error.
- **Two submission formats** — Email (narrative, under 250 words) and Bullet (structured plain-text bullets, under 150 words). Toggle appears before generation and after — switch format and Regenerate.
- **Submission draft on Candidate Card** — "Draft Submission" button in the page header. Supports JD Specific (pick a pipeline role, pulls its JD) or Generic (candidate record only). Same modal pattern: format toggle, Generate, editable textarea, Save to Queue or Copy.

---

## Database (Supabase)

Key tables:
- `recruiters` — auth user profile
- `candidates` — full candidate record including `cv_text`, `career_timeline` (JSONB), `career_signals` (JSONB), `fit_score`
- `roles` — open positions, linked to clients, includes `jd_text`, `process_steps`
- `pipeline` — candidate × role junction. Tracks `current_stage`, `fit_score`, stage history
- `clients` — companies, with contacts
- `client_contacts` — contacts linked to clients
- `interactions` — permanent record of all touchpoints
- `messages` — drafted/queued outreach (status: drafted, approved, sent, held)
- `daily_briefs` — morning brief data

---

## Key Components

- `CandidateCard.jsx` — main candidate view. Contains career timeline, screener, signal badges, scores history, next action
- `RoleDetail.jsx` — role view with kanban pipeline board
- `Candidates.jsx` — candidate database table
- `MorningBrief.jsx` — daily brief with stat cards
- `ClientDetail.jsx` — client view with contacts
- `api/ai.js` — all Anthropic API calls go through here server-side
- `src/lib/prompts/submissionDraft.js` — prompt builder for submission drafts. Accepts `format` ('email' | 'bullet'). Email = narrative under 250 words. Bullet = structured plain-text under 150 words.

---

## Known Bugs / Recent Fixes

- **Fixed (2026-04-14):** Null recruiter guard in CandidateCard.jsx useEffect. Changed `if (!id)` to `if (!id || !recruiter?.id)`. This was preventing career timeline from persisting.
- **Fixed (2026-04-14):** Screener score now fetches pipeline entry fresh before saving to avoid stale state overwrite.
- **Fixed (2026-04-14):** One-click stage advance on kanban — advance button on each candidate card updates stage in Supabase and re-renders column instantly without page navigation.

---

## Product Principles (Non-Negotiable)

**Human first, AI in the middle, human last.**
Wren handles the work between human touchpoints. The recruiter opens their day with a brief, works their roles, and closes with a queue of actions to review. AI fills everything in between.

**Dirty data in, clean intelligence out.**
Recruiters work with incomplete information constantly. A resume with no metrics, a JD scraped from a website, a candidate with a sparse profile. Wren takes whatever it gets and makes it useful. Never refuse to work because data is incomplete. Extract what's there, flag what's missing, move forward.

**The candidate database is the asset.**
Every recruiter's most valuable thing is their network and their history. Wren is where that lives and compounds. Every interaction, every score, every note makes the record richer. The database should feel like it's building itself.

**Enrich over time.**
Nothing in Wren is ever finished. A candidate record gets better every time you touch it. A role gets smarter as you add candidates. A client builds context with every interaction. Design everything to accumulate value, not just store data.

**Speed is respect.**
A recruiter's time is their inventory. Every extra click, every page load, every manual step is a tax on their livelihood. One click to screen. One click to advance a pipeline stage. One click to draft an outreach. If it takes more than one motion it needs to be redesigned.

**Build for the solo recruiter first.**
No team features, no admin panels, no enterprise complexity. The person using Wren is working alone, moving fast, juggling 10 open roles and 50 candidates. Every feature should make that specific person's day easier. If it doesn't serve a solo recruiter in the field it doesn't ship.

**Real use beats perfect design.**
Ryan uses Wren on real Paraform roles with real candidates. Every bug found in real use is more valuable than 10 features built in theory. When something breaks on a real candidate or a real role, fix it before building anything new.

**The screener is only as good as the data.**
Garbage in, garbage out. A candidate with empty cv_text will always score poorly. The most important thing Wren can do is capture complete data on every record. CV extraction, career parsing, interaction notes, call transcripts. Feed the machine.

**Show don't ask.**
Wren should surface what matters without being asked. Signal badges on a candidate card. Fit scores in the candidate list. Next action generated automatically. The recruiter should open a record and immediately know what to do next without hunting for context.

---

## Current Priority Queue

1. ~~**Candidate submission drafting**~~ ✓ Shipped 2026-04-14
2. ~~**Bidirectional pipeline movement**~~ ✓ Shipped 2026-04-14
3. ~~**Two submission formats (Email / Bullet)**~~ ✓ Shipped 2026-04-14
4. ~~**Submission draft on Candidate Card**~~ ✓ Shipped 2026-04-14
5. **Mobile responsive CSS** — Recruiter uses Wren between calls, before interviews. Currently desktop only.
6. **JD formatting polish** — AI cleans the display version of a scraped JD. Currently raw.
7. **Call mode screen** — A focused view for during/after a candidate or client call.
8. **Call notes ingestion** — Drop in raw call notes, Wren structures and saves to the candidate record.
9. **LinkedIn outreach drafting** — Generate a personalized connection request or InMail from the candidate card. Copy and send from LinkedIn.

---

## Decisions Log

- **AI calls are server-side only.** All Anthropic API calls go through api/ai.js. Key never touches the client. Non-negotiable.
- **JSONB for flexible data.** Career timeline, career signals, and process steps use JSONB columns so structure can evolve without migrations.
- **One-click as the design bar.** Any action that takes more than one motion gets flagged for redesign.
- **No LinkedIn API.** Too locked down. LinkedIn strategy is: (1) draft outreach inside Wren, copy/paste to send, (2) accept manual profile paste as a CV input source, (3) Chrome extension is the right v2 play for frictionless candidate capture from LinkedIn profiles.
- **Paraform is the primary submission channel.** Wren needs to make submissions faster and more compelling than what a tired recruiter writes at 4pm.

---

## How to Start a Session

In Claude Code:
```
read WREN.md
```
Then state what you're building. Claude will have full context and can proceed without re-briefing.

After each session, update the following sections in this file:
- What's Built and Working (if something new shipped)
- Known Bugs / Recent Fixes (if something was fixed)
- Current Priority Queue (reorder or check off completed items)
- Decisions Log (if a new architectural or product decision was made)
