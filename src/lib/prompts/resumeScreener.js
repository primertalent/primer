// clientHistory: optional { recent_debriefs: [{ candidate_name, outcome, summary, risk_flags, date }] }
// When provided, the screen output explicitly flags whether this candidate shares patterns
// that caused prior candidates to fail at this client — this is the quality gate for /wren.
export function buildScreenerMessages(candidate, role, clientHistory = null) {
  const today = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date())
  const skills = candidate.skills?.join(', ') || 'None listed'
  const cv = candidate.cv_text
    ? `\n\nFULL CV / RESUME TEXT:\n${candidate.cv_text}`
    : ''
  const jd = role.notes
    ? `\n\nJOB DESCRIPTION:\n${role.notes}`
    : ''
  const steps = Array.isArray(role.process_steps)
    ? role.process_steps.join(' → ')
    : (role.process_steps || 'Not specified')

  const clientHistorySection = clientHistory?.recent_debriefs?.length
    ? `\n\nCLIENT OBJECTION HISTORY — ${role.clients?.name ?? 'this client'} (last ${clientHistory.recent_debriefs.length} candidate(s)):\n${
        clientHistory.recent_debriefs.map(d =>
          `- ${d.candidate_name} (${d.date ?? 'unknown date'}): outcome=${d.outcome ?? 'unknown'}${d.summary ? ` — ${d.summary.slice(0, 250)}` : ''}${
            Array.isArray(d.risk_flags) && d.risk_flags.length
              ? `\n  Risk flags: ${d.risk_flags.join(', ')}`
              : ''
          }`
        ).join('\n')
      }\n\nIMPORTANT: In your evaluation, explicitly state whether this candidate shares any of the gaps or risk patterns from this history. Name the pattern and name the candidate's gap. Do not soften it. If this client has passed candidates for a specific reason before, say so directly in top_concerns or red_flags.`
    : ''

  const prompt = `Today's date: ${today}. Use this for all temporal calculations — employment gaps, tenure durations, "currently employed" assessments. Never flag a date that has already passed as a future or impossible date.

You are an expert technical recruiter with 20 years of experience evaluating candidates against job specifications.

Evaluate this candidate against the role below and return ONLY a valid JSON object. No markdown, no explanation, no code fences — raw JSON only.

CANDIDATE PROFILE
Name: ${candidate.first_name} ${candidate.last_name}
Current Role: ${candidate.current_title ?? 'Unknown'} at ${candidate.current_company ?? 'Unknown'}
Location: ${candidate.location ?? 'Unknown'}
Skills: ${skills}
Notes: ${candidate.notes || 'None'}${cv}

ROLE SPECIFICATION
Title: ${role.title}
Client: ${role.clients?.name ?? 'Unknown'}
Hiring Process: ${steps}${jd}${clientHistorySection}

Score meaning — all-things-considered advance confidence, not raw skills overlap. A material gap, missing must-have, or red flag must pull the score down even when skills match is high:
8-10: advance — fit, trajectory, and risk all support submission. Ready to move.
4-7:  hold — real gaps or risk present, but workable. Do not decline; park and compare.
1-3:  pass — genuine no. Material mismatch or disqualifying risk.

Do not include a recommendation field. Score your confidence; the system assigns the label from the band.

Return this exact JSON structure (use null for unknown, empty array [] for none found):
{
  "match_score": <integer 1–10>,
  "skills_match": [{ "skill": <string>, "status": "full" | "partial" | "missing" }],
  "career_trajectory": <string — 1–2 sentence assessment>,
  "quantified_results": <string — list specific numbers and metrics found, or note their absence>,
  "top_strengths": [<string>, <string>, <string>],
  "top_concerns": [<string>, <string>, <string>],
  "red_flags": [<string>],
  "recommendation_reason": <string — exactly one sentence explaining what drove the score>
}

Red flag framework — check each and include any that apply:
- Job hopping: multiple tenures under 18 months with no clear rationale
- Unexplained gaps: employment gaps over 6 months with no explanation
- No quantified results: resume lists only duties, zero measurable impact anywhere
- Vague responsibilities: generic descriptions without scope, team size, or ownership
- Title inflation: claimed title inconsistent with apparent seniority or scope of work
- AI-generated resume: uniform formatting throughout, generic action verbs, no specific details or metrics`

  return [{ role: 'user', content: prompt }]
}
