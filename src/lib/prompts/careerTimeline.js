/**
 * Parses unstructured CV text into a structured career timeline + signal badges.
 *
 * Returns JSON:
 * {
 *   timeline: [
 *     { company: string, title: string, start: string, end: string, achievements: string[] }
 *   ],
 *   signals: string[]   // subset of: Promoted, Long Tenure, Fast Riser, AI Experience, President's Club, Quota Buster
 * }
 */
export function buildCareerTimelineMessages(cvText) {
  const prompt = `You are a recruiting intelligence assistant. Parse the following CV/resume text and extract a structured career timeline plus career signal badges.

Return ONLY valid JSON matching this exact schema — no markdown, no explanation:
{
  "timeline": [
    {
      "company": "Company name",
      "title": "Job title",
      "start": "Month Year or Year",
      "end": "Month Year or Year or Present",
      "achievements": ["achievement 1", "achievement 2"]
    }
  ],
  "signals": ["badge1", "badge2"]
}

Rules for timeline:
- Order from most recent to oldest
- Include all jobs, internships, and major consulting engagements
- Achievements should be the 1–3 most notable bullet points from that role (quantified if possible)
- If dates are ambiguous or missing, use your best estimate or omit the field

Rules for signals — only include a badge if clearly supported by the CV text:
- "Promoted": candidate was promoted within the same company
- "Long Tenure": at least one role lasting 5+ years
- "Fast Riser": reached a senior/director/VP/C-level title by age 32 or within 5 years of career start
- "AI Experience": worked with machine learning, LLMs, AI products, data science, or related fields
- "President's Club": explicitly mentioned President's Club or equivalent sales award
- "Quota Buster": explicitly mentioned exceeding quota, accelerators, or top performer in a sales/revenue role

CV TEXT:
${cvText}`

  return [{ role: 'user', content: prompt }]
}
