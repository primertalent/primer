# FRICTION.md

Live log of friction encountered during real use. Capture, don't fix mid-session. Each entry is a data point; patterns across entries drive the next build decision.

Format: `Date | Stage | What happened | Tag`

Tags: `manual_step` / `bug` / `missing_data` / `shape_problem` / `saas_shape` / `feature_pattern` / `external_limitation`

---

<!-- Append new entries below, newest at top -->

6/15 | agent_capability | OPEN. When a role has no placement fee on file, pipeline value is silently reduced with no prompt to add one. Recruiter has no signal that an unpriced role is dragging the weighted total. Flag needed: inline on role card or ticker callout ("N roles missing fee"). | missing_data

6/15 | agent_capability | RESOLVED. Wren pantomimed "updated comp" and "added a fee" with no tool to do either — acknowledged writes that never happened. Fixed: set_comp and set_fee tools added (api/wren.js, commits aa7f6d2 + b9cdc5c). Honesty rule added as Rule 8 to wrenAgent.js (commit b9cdc5c): announce from tool's returned values; say "I don't have a way to save that yet" when no tool exists; surface implausible flags and wait for confirm. | bug

6/15 | agent | RESOLVED. Stage-aware next-move suggestions were firing stale moves — Wren offered to screen or draft a submittal for candidates already past submitted stage. Fixed: suppression clause leads, stage-gated suggestions follow as a constraint on the rare warranted move. (wrenAgent.js, commit 9baf418) | bug

6/15 | agent | RESOLVED. Stale process_steps vocabulary surfaced in role pulls. Output rule: reference data (process steps, JD text, raw notes) suppressed by default; only deal signals surface. (wrenAgent.js + commit d3e3620) | bug

6/15 | agent | RESOLVED. Role pull transcription — entity pull prose was re-listing tool result fields instead of compressing to the one signal worth flagging. Output rule tightened: card owns the facts; prose compresses to the read (what to flag) and the move (what to do). (wrenAgent.js + commit dc0bda0) | shape_problem

6/12 | candidate_enrichment | Contradiction on key facts held silently. During Illia testing, notes said "needs sponsorship" and a later ingestion implied no sponsorship needed — Wren merged both without surfacing the conflict. Model never flagged that a new value contradicted an existing one. Key fields (work auth, comp expectation, notice period, location preference) need ingest-time conflict detection: when a new ingestion contradicts a stored value, surface it to the recruiter before writing. NEXT WEEK'S P1 SLICE. | bug

6/12 | onboarding | Email-connect flow is not beta-shippable. The CloudMailin auto-forward setup requires the recruiter to manually verify a forwarding address through their Gmail settings — no guided flow, no in-app state confirmation, no fallback if they get it wrong. Recruiter drop-off risk is near-certain at this step. BETA BLOCKER. Fix path: guided connect screen with step-by-step instructions + polling for first delivery confirmation, or switch to Google read-scope OAuth (no forwarding required). | shape_problem

6/12 | ingestion | ingestion_log only records discards. A successfully processed inbound email leaves no trace in the log — during debug, "no log entry" was indistinguishable from "never arrived," "classified wrongly," or "silent error." Should log every inbound with classification outcome, matched entity ID, and action taken. | missing_data

6/12 | agent | Wren cannot delete records on explicit instruction. Recruiter tested "delete that candidate" and hit a dead end — no tool exists for deletion. Wren acknowledged the gap but could not act. Tier 1 build: confirm-then-delete for candidate, role, and client records (confirm with entity name + consequence statement, then execute on second turn). | feature_pattern

6/12 | search | Role search in Ctrl-K palette is title-only. Searching by client name (e.g., "Beacon") returns nothing if the role title doesn't contain that string — PostgREST .or() can't traverse joined columns (roles.clients.name). Fix: add a denormalized client_name column to roles (populated on insert/update), or add a separate client-search path in the palette. | bug

6/12 | morning_brief | Brief race at day boundary — second observation. Same read-then-insert race logged 6/11 re-confirmed today during a two-tab test. The unique index on (conversation_id, brief_date) would make the second insert fail cleanly. Low urgency for solo user but the double-brief symptom is jarring. Add the index when convenient. | bug

6/11 | morning_brief | Race condition: existingBrief check in compose-brief.js is read-then-write. existingBrief check in compose-brief.js is read-then-write. Two simultaneous loads at a day boundary (two tabs, slow network) can both read "no brief," both call Haiku, both insert, and the recruiter sees Wren introduce the day twice. Probability is low for a solo user but the symptom is ugly and costs a double Haiku charge. Cheap hardening: unique index on (conversation_id, brief_date) extracted from the JSONB so the second insert fails cleanly and falls back to the read. Not tonight. If tomorrow's acceptance ever shows two briefs, this is why. | bug

6/3 | ingestion | Lazy-recruiter-test failure — three faces of one root-cause bug. (1) Paste a resume (no upload option existed): Wren used pasted text in-session but did not create or persist a candidate record. Profile should auto-create on paste; recruiter had to create the candidate separately. (2) Paste a JD for a role not in the DB: Wren recognized the company but screener and submittal-draft tools both require a role_id — fell back to a manual screen. When asked to create the role from the pasted JD, Wren said it can't. Recruiter's natural "create the role from what I pasted" is unsupported. (3) Paste call notes: Wren enriched correctly in-session (resolved the coding-depth question on Annie/Fulcrum) but did not persist the signal to the candidate record. Notes were gone on next open. Vision says Wren captures, recruiter enriches. Right now the recruiter feeds Wren manually every turn and nothing persists. | manual_step

6/3 | ingestion | Pasting large text blocks (resume, JD, notes) dumps raw text into the thread instead of converting to a chip. Claude converts pastes to chips — same pattern should apply here. The chip is the natural attachment point for ingestion: resume chip → candidate record, JD chip → company + role, notes chip → candidate enrichment. Pair paste-to-chip with the auto-create-record work — they solve the same root cause together. | shape_problem

6/3 | submittal_draft | Format choice dropped (feature regression). Three formats were deliberately built: bulleted, paragraph (email), concise (Slack). Wren produced one without offering the choice or prompting for it. Format parameter likely not reaching the model or defaulting silently. | shape_problem

6/3 | screen_evaluation | Rule-zero miss on pedigree claim. Wren wrote "University of Minnesota, top-10 CS program" in both internal and external drafts. Minnesota clears the client's actual top-100 bar (true) but "top-10" is invented — not in the resume, not in call notes. Fabricated ranking reached the HM-ready external surface. Motivation guard fired correctly on the same draft; pedigree claim did not get the same scrutiny. Fix: state the school plainly or tie to the real requirement, never invent a ranking. | bug

6/3 | ui | Rendered submittal output had poor line breaks and strange formatting. Two-surface content was correct (moat behavior confirmed, Annie/Fulcrum) but the render needs a polish pass before any external use. | shape_problem

6/3 | intake | "Screen Nick Bulow against the Unit SDR role" returned empty on both candidate and role on first try. "View candidate Nick Bulow" then worked, and screening proceeded via the pipeline role ID. The screen-path search may not be applying the name-split and role-expansion fixes the same way the direct candidate lookup does, or deploy lag. Search fix confirmed at DB level (Nick stored first/last correctly, role is "Sales Development Representative" at client "Unit") but the combined screen-against-role entry path still failed first. | bug

6/3 | candidate_enrichment | Motivation present in the candidate record but dropped from the submittal synthesis. The candidate-view surfaced "Nick is leaving due to organizational shifts and in-person office mandates, Unit is remote, clean motivation story," but the internal and external drafts both returned motivation as NOT CAPTURED / [NEEDS: stated reason]. The data exists in the record and did not flow into the draft. The motivation is the strongest external selling line and it got dropped. | missing_data

6/3 | screen_evaluation | Screen contradicted itself on the same fact. For Nick Bulow against Unit SDR, the screen listed "no early-stage experience, Owner.com and Meltwater are established venture-backed companies" as a concern, then the internal submittal listed "Owner.com is an SMB/mid-market restaurant tech startup, early-stage, high-velocity" as a why-fit bullet. Same company, opposite claims. Rule-zero reach: Wren asserted a fit it had just flagged as a concern. | bug

5/21 | all | RESOLVED. Session 2 card lifecycle fixes validated in real use on Gemini Notes intake smoke test: P4-1 auto-match, P4-2 comp extract on confirmed matches, debrief auto-fire on ingestion path, Tier 1 and Tier 2 inline chip handlers all working. No navigation off Desk observed. | bug

5/21 | intake | Gemini Notes email body contains summaries only, not full transcripts. Full meeting content sits behind "Open meeting notes" link in Google Docs. Wren extracts what it has but signal quality is limited by Gemini's email surface. Not a Wren bug — Gemini is the wrong tool for transcript-quality intake. Path forward: recommend Fathom/Granola/Otter in onboarding materials, or build Google Docs OAuth + fetch (V2+). | external_limitation

5/21 | submittal_draft | "Save to queue" button appears after submittal draft creation but no queue exists — queue was deleted per Phase 2 strip-down. Dead button or stale label mapped to a removed surface. Needs diagnosis: either remove the button or remap to a current surface. | bug

5/21 | agent_loop | RESOLVED. Loop failures from 5/20 traced to Vercel Hobby 10s timeout with real data in the DB. Fix A (batched dedup in agent-loop-runner.js, commit 8ab4efc) brought execution under the ceiling. Pro upgrade deferred. Watch for re-occurrence as data grows. | bug

5/20 | desk_handlers | Partial fix on Tier 2 chips: prep_for_interview, prep_call, queue_follow_up, draft_urgency_note, draft_inbound_reply open the candidate panel but no specific flow auto-opens. Recruiter stays on /desk URL but still has to find the relevant action inside the panel. Future session needs dedicated modals or wiring to existing surfaces. | shape_problem

5/20 | submittal_draft | STRATEGIC. Submittal drafting must be multi-turn collaboration, not one-shot generation. Recruiter spent a full Claude session iterating on a real submittal as back-and-forth refinement to get it right. The submittal is Wren's highest-stakes output and the moat moment — treating it as fire-and-forget breaks the product promise. | feature_pattern
5/20 | intake | Candidate 2 re-attempt produced the same name parse failure after discard and re-forward — same bad output, no recovery path. | bug
5/20 | intake | Candidate 2 Gemini Notes contained a very limited summary; likely root cause of parse failure. | missing_data
5/20 | intake | Candidate 2 parsed as recruiter's own name instead of the candidate's — sender vs. candidate confusion in forwarded Gemini Notes. | bug
5/20 | pipeline_stage | No clear mechanism on Desk to move a candidate through pipeline stages or see stage status at a glance. | shape_problem
5/20 | pipeline_stage | "Log debrief" CTA navigates away from Desk to candidate page instead of staying in context. | shape_problem
5/20 | pipeline_stage | Action card "no interactions logged" appeared after shortlisting a candidate whose point of entry was an interview call. | bug
5/20 | screen_evaluation | Screen-against-role scored the same candidate 6/10 while the original screen returned 9/10 — inconsistent signal from the same data. | bug
5/20 | submittal_draft | Submittal generation is one-shot — no multi-turn refinement or collaboration with Wren to iterate toward the right output. | shape_problem
5/20 | submittal_draft | Bullet-format submittal output is noticeably weaker than the email-format equivalent. | shape_problem
5/20 | submittal_draft | After navigating to the candidate page, recruiter had to locate "draft submission" a second time — double-click moment. | shape_problem
5/20 | submittal_draft | Clicking "draft submission" from the action card navigates off Desk to the candidate page in Network. | shape_problem
5/20 | candidate_enrichment | Resume chip processing was noticeably slower than the role drop chip. | shape_problem
5/20 | candidate_enrichment | No clear surface to attach a resume — recruiter defaulted to dropping it on the main Desk. | shape_problem
5/20 | candidate_enrichment | Limited candidate signals generated from call notes despite substantial notes available. | missing_data
5/20 | candidate_enrichment | Debrief did not trigger automatically after Gemini Notes were parsed. | manual_step
5/20 | candidate_enrichment | Comp details were not auto-parsed from forwarded Gemini call notes. | missing_data
5/20 | role_creation | Action card "add fee to role" persisted after fee was saved; recruiter had to manually X it out. | bug
5/20 | role_creation | Agreement modal does not follow design rules. | shape_problem
5/20 | role_creation | Fee-setting modal does not follow design rules. | shape_problem
5/20 | role_creation | JD reformatting was visible to the recruiter as it happened — should run silently in the background. | shape_problem
5/20 | role_creation | Ghost action card from an old build appeared alongside the new role creation card after role drop. | bug
