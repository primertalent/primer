// Returns JSON: { overall_score, verdict, recommendation, dimensions }
// dimensions: { experience_fit, skills_match, career_trajectory, culture_signals, red_flags }
// Each dimension: { score: 1-5, rationale: string }
// red_flags: 5 = clean (none), 1 = serious concerns (inverted scale)
export function buildScorecardMessages(candidate, role, screenerResult) {
  const skills = candidate.skills?.join(', ') || 'None listed'
  const signals = candidate.career_signals ?? []

  const timelineSection = candidate.career_timeline?.length
    ? `\nCAREER TIMELINE:\n${candidate.career_timeline
        .map(e => `- ${e.title} at ${e.company} (${e.start} – ${e.end ?? 'Present'})${
          e.achievements?.length ? '\n  ' + e.achievements.join('\n  ') : ''
        }`)
        .join('\n')}`
    : ''

  const cvSection = candidate.cv_text
    ? `\nFULL CV TEXT:\n${candidate.cv_text.slice(0, 6000)}`
    : ''

  const screenerSection = screenerResult
    ? `\nEXISTING SCREENER RESULT:
Match score: ${screenerResult.match_score}/10
Recommendation: ${screenerResult.recommendation}
Reason: ${screenerResult.recommendation_reason ?? 'N/A'}
Strengths: ${screenerResult.top_strengths?.join(', ') ?? 'N/A'}
Concerns: ${screenerResult.top_concerns?.join(', ') ?? 'N/A'}
Red flags: ${screenerResult.red_flags?.join(', ') || 'None'}`
    : ''

  const jdSection = role.notes
    ? `\nJOB DESCRIPTION:\n${role.notes.slice(0, 4000)}`
    : ''

  const prompt = `You are an expert technical recruiter conducting a deep evaluation of a candidate for a specific role. You use structured scoring to prevent "best talker wins" and ensure decisions are evidence-based. This scorecard is for candidates being seriously considered for submission — it goes deeper than a quick screen.

You know the 15 Candidate Red Flags:
1. Vague about responsibilities — can't say what THEY specifically did
2. Frequent job changes with no clear narrative
3. Blame pattern — managers/teams/companies always at fault
4. All self-credit, never acknowledges team
5. Can't explain why they want THIS role at THIS company
6. Only motivated by salary — no interest in growth or impact
7. No questions about the role — passive, disengaged
8. Resume inconsistencies — timeline gaps, title inflation
9. Can't explain technical decisions — "best practice" with no reasoning
10. No curiosity about company problems or market
11. Unrealistic expectations about timeline or impact
12. Won't discuss failures — every story is a win
13. Dismissive of company stage or market position
14. Evasive about previous employer relationships
15. No growth narrative — unclear where they're headed

Scoring philosophy:
- Be honest, not generous. A 3 means adequate, not good.
- Evidence-based: every score must be grounded in what's actually in the CV and profile
- Rationales must be specific, not generic ("8 years in B2B SaaS" not "relevant experience")
- If data is missing, say so in the rationale and score conservatively

DIMENSION SCORING:

experience_fit (1-5):
5 = Direct, deep experience exactly matching this role's requirements
4 = Strong experience with minor gaps or different context
3 = Relevant experience but some significant gaps or mismatch
2 = Tangential experience — related but not directly applicable
1 = Little or no relevant experience for this specific role

skills_match (1-5):
5 = All required skills present with depth and evidence of application
4 = Most required skills present, minor gaps in secondary skills
3 = Core skills present, missing some important secondary skills
2 = Some skills present but key requirements missing or shallow
1 = Few or no required skills evidenced in their background

career_trajectory (1-5):
5 = Clear upward progression, promotions, increasing scope and responsibility
4 = Steady growth with at least one significant step up
3 = Lateral movement or steady progression without notable advancement
2 = Unclear trajectory, possible stagnation, or unexplained moves
1 = Concerning pattern — job hopping, downward movement, unexplained gaps

culture_signals (1-5):
5 = Strong evidence of ownership, team collaboration, growth mindset, engagement
4 = Good signals with minor gaps — generally positive indicators
3 = Neutral — no strong positive or negative signals
2 = Some concerning signals — possible blame pattern, all self-credit, disengagement signs
1 = Clear cultural risk — blame pattern, dismissive of teams, zero curiosity

red_flags (1-5) — INVERTED: higher is cleaner, lower is more concerning:
5 = No red flags detected. Clean background, consistent narrative, full ownership
4 = Minor flags only (short tenure at one role, small unexplained gap) — explainable
3 = One notable flag worth probing — doesn't disqualify but requires a question
2 = Multiple flags or one serious one — significant concern, probe hard before advancing
1 = Disqualifying flags — clear blame pattern, resume inconsistencies, job hopping without narrative

OVERALL SCORE (1-10):
Weight experience_fit and skills_match most heavily (must-haves). Career trajectory and culture signals are important. Red flags can drag down an otherwise good score significantly.

Recommendation thresholds:
- 8-10: advance (strong submit candidate)
- 6-7: hold (qualified, compare with others)
- 4-5: probe (red flags or gaps need addressing first)
- 1-3: pass (not a fit)

CANDIDATE
Name: ${candidate.first_name} ${candidate.last_name}
Current: ${candidate.current_title ?? 'Unknown'} at ${candidate.current_company ?? 'Unknown'}
Location: ${candidate.location ?? 'Not specified'}
Skills: ${skills}
Career Signals: ${signals.length ? signals.join(', ') : 'None detected'}${timelineSection}${cvSection}

ROLE
Title: ${role.title}
Client: ${role.clients?.name ?? 'Unknown'}${jdSection}${screenerSection}

Return ONLY a valid JSON object, no markdown, no explanation:
{
  "overall_score": <integer 1-10>,
  "verdict": "<one sentence — specific, evidence-based, no filler>",
  "recommendation": "advance" | "hold" | "probe" | "pass",
  "dimensions": {
    "experience_fit":     { "score": <1-5>, "rationale": "<one specific sentence>" },
    "skills_match":       { "score": <1-5>, "rationale": "<one specific sentence>" },
    "career_trajectory":  { "score": <1-5>, "rationale": "<one specific sentence>" },
    "culture_signals":    { "score": <1-5>, "rationale": "<one specific sentence>" },
    "red_flags":          { "score": <1-5>, "rationale": "<one specific sentence — note any flags detected or confirm clean>" }
  }
}`

  return [{ role: 'user', content: prompt }]
}
