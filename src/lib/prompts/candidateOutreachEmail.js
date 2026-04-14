// Returns JSON: { subject: string, body: string }
export function buildOutreachEmailMessages(candidate, role) {
  const skills = candidate.skills?.join(', ') || 'None listed'
  const signals = candidate.career_signals ?? []

  const signalContext = signals.length
    ? `\nCAREER SIGNALS: ${signals.join(', ')}`
    : ''

  const roleContext = role
    ? `\nROLE
Title: ${role.title}
Client: ${role.clients?.name ?? 'Unknown'}${
        (role.comp_min || role.comp_max)
          ? `\nComp: ${formatComp(role.comp_min, role.comp_max, role.comp_type)}`
          : ''
      }${role.notes ? `\nJD Notes: ${role.notes.slice(0, 1500)}` : ''}`
    : ''

  // Detect approach based on signals and seniority
  const isCompetitorHire = signals.includes('Promoted') || signals.includes('Fast Riser')
  const isSenior = /VP|Director|Head of|Chief|Principal|Partner/i.test(candidate.current_title ?? '')
  const hasQuota = signals.includes('Quota Buster') || signals.includes("President's Club")

  const approachNote = isSenior
    ? `Use the Humble Approach: conversational, low-pressure, acknowledge they may not be looking. Include "Not sure if you're open to conversations, but figured I'd reach out." Soft CTA like "Open to a quick conversation? No pressure either way."`
    : isCompetitorHire || hasQuota
    ? `Use the Competitor/Achievement Approach: open by naming what they've done specifically. Frame this role as the natural next move given that track record. Confident CTA.`
    : `Use the Direct Approach: salary transparency in the first email, specific reference to their background, 3 perks, direct CTA like "Want to see the full JD?"`

  const prompt = `You are an outreach email specialist who writes cold recruiting emails that get 25-35% reply rates (vs. 2-5% industry average). You know:
- Salary transparency increases reply rates by 40%+
- Short emails outperform long ones — 150 words maximum for the body
- Every email must reference something specific about the candidate, not generic praise
- Specific numbers and role context beat vague pitches
- Follow these rules absolutely:
  - NO em dashes (—)
  - NO corporate language ("exciting opportunity", "passionate", "self-starter", "results-driven")
  - NO generic openers ("I came across your profile and was impressed")
  - Subject line must reference their work, their skill, or the salary — never just "Opportunity at [Company]"
  - CTA must be a single, specific, low-friction ask — one question, easy yes or no
  - 3 paragraphs max, each earning its place

Approach to use: ${approachNote}

Subject line rules:
- Include salary if available: "{{job_opening}} opportunity - $150-180k"
- OR reference their specific background: "Your [skill/company] background + [role]"
- OR use curiosity: "Quick question for you"
- Never: "Exciting Opportunity", "Let's Talk About Your Career", generic job titles alone

Body structure (150 words max):
1. Hook — reference something specific about their background (company, title, a signal like their promotion history or quota performance). One sentence.
2. The pitch — role title, company, salary range (specific: "$150-180k" not "$150k+"), 2-3 real perks that matter
3. CTA — one low-friction question. "Want to see the full JD?" or "Open to a quick call?" or "Does this sound interesting?"

CANDIDATE
Name: ${candidate.first_name} ${candidate.last_name}
Current: ${candidate.current_title ?? 'Unknown'} at ${candidate.current_company ?? 'Unknown'}
Location: ${candidate.location ?? 'Not specified'}
Skills: ${skills}${signalContext}${roleContext}

Return ONLY a valid JSON object with exactly two fields, no markdown, no explanation:
{
  "subject": "<subject line>",
  "body": "<email body, plain text, no markdown>"
}`

  return [{ role: 'user', content: prompt }]
}

function formatComp(min, max, type) {
  if (!min && !max) return null
  const fmt = n => `$${Number(n).toLocaleString()}`
  const range = (min && max)
    ? `${fmt(min)} - ${fmt(max)}`
    : min ? `${fmt(min)}+` : `Up to ${fmt(max)}`
  const suffixes = {
    salary: '/yr',
    hourly: '/hr',
    contract: '/yr',
    equity_plus_salary: '/yr + equity',
  }
  return `${range}${suffixes[type] ?? ''}`
}
