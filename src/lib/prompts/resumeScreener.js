export function buildScreenerMessages(candidate, role) {
  const skills = candidate.skills?.join(', ') || 'None listed'
  const cv = candidate.cv_text
    ? `\n\nFULL CV / RESUME TEXT:\n${candidate.cv_text}`
    : ''
  const jd = role.notes
    ? `\n\nJOB DESCRIPTION:\n${role.notes}`
    : ''
  const steps = role.process_steps?.join(' → ') || 'Not specified'

  const prompt = `You are an expert technical recruiter with 20 years of experience evaluating candidates against job specifications.

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
Hiring Process: ${steps}${jd}

Return this exact JSON structure (use null for unknown, empty array [] for none found):
{
  "match_score": <integer 1–10>,
  "skills_match": [{ "skill": <string>, "status": "full" | "partial" | "missing" }],
  "career_trajectory": <string — 1–2 sentence assessment>,
  "quantified_results": <string — list specific numbers and metrics found, or note their absence>,
  "top_strengths": [<string>, <string>, <string>],
  "top_concerns": [<string>, <string>, <string>],
  "red_flags": [<string>],
  "recommendation": "advance" | "hold" | "pass",
  "recommendation_reason": <string — exactly one sentence>
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
