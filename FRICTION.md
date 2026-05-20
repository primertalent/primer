# FRICTION.md

Live log of friction encountered during real use. Capture, don't fix mid-session. Each entry is a data point; patterns across entries drive the next build decision.

Format: `Date | Stage | What happened | Tag`

Tags: `manual_step` / `bug` / `missing_data` / `shape_problem` / `saas_shape` / `feature_pattern`

---

<!-- Append new entries below, newest at top -->

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
