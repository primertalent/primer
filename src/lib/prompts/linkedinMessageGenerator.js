// Returns plain text — LinkedIn connection request message, under 300 characters
export function buildLinkedInMessageMessages(candidate, role, recruiter = null) {
  const skills = candidate.skills?.slice(0, 2).join(' and ') || 'your background'
  const signals = candidate.career_signals ?? []

  const roleContext = role
    ? `Role: ${role.title} at ${role.clients?.name ?? 'our company'}${
        (role.comp_min || role.comp_max) ? ` (${formatComp(role.comp_min, role.comp_max, role.comp_type)})` : ''
      }`
    : null

  // Select approach based on candidate signals and seniority
  const isSenior = /VP|Director|Head of|Chief|Principal|Partner|C-level|CEO|CTO|CPO|CFO/i.test(candidate.current_title ?? '')
  const isCompetitor = signals.includes('Promoted') && candidate.current_company
  const hasQuota = signals.includes('Quota Buster') || signals.includes("President's Club")
  const isFastRiser = signals.includes('Fast Riser')

  let approachGuide
  if (isSenior) {
    approachGuide = `Use the Compliment/No-Pressure approach (Variation 3). Genuine specific compliment on their work. "Not sure if you're exploring roles, but..." removes pressure. "Worth a conversation?" as CTA. Senior people get heavy outreach — low pressure wins.`
  } else if (isCompetitor || hasQuota) {
    approachGuide = `Use the Competitor/Achievement approach (Variation 4). Open by naming what they've specifically done at ${candidate.current_company}. Frame this role as doing it at a different scale or context. "Interested in the challenge?" as CTA.`
  } else if (isFastRiser) {
    approachGuide = `Use the Growth-Trajectory approach (Variation 5). Acknowledge what they've built at their current company. Frame this role as the natural next step up in scope and ownership. "Think that's your next move?" as CTA.`
  } else {
    approachGuide = `Use the Direct/Salary-Focused approach (Variation 1). Reference their specific skill or company background. State the role and salary. End with the salary question: "What salary would you target if you moved?" — this is the highest-converting CTA on LinkedIn.`
  }

  const prompt = `You are a LinkedIn outreach expert who achieves 20-35% reply rates on connection messages (vs. 2-5% industry average).

Write a LinkedIn connection request message for this candidate. This is a connection request, not an InMail — it has a hard 300 character limit. Every character counts.

Structure (3 sentences, 300 characters max total):
1. Why you're reaching out — reference something specific about their background (company name, role, or a signal like quota performance or career growth). Never write "I came across your profile and was impressed."
2. The opportunity — one sentence on the role and comp if available. Be specific.
3. CTA — one direct question. Easy yes or no.

Approach: ${approachGuide}

Rules:
- 300 characters MAXIMUM (count carefully. LinkedIn will reject longer messages.)
- No em dashes (—), en dashes (–), or dashes as punctuation breaks. Use periods.
- No generic phrases: "exciting opportunity", "passionate", "self-starter", "great background", "leveraged", "spearheaded"
- No AI writing tells: "Additionally", "Furthermore", "It is worth noting"
- No corporate language of any kind
- Mobile-first: short lines, each sentence on its own line
- Salary transparency where available. It signals you're serious.
- Specific beats generic every time
- Sound like a person, not a tool

CANDIDATE
Name: ${candidate.first_name} ${candidate.last_name}
Current: ${candidate.current_title ?? 'Unknown'} at ${candidate.current_company ?? 'Unknown'}
Skills: ${skills}
Signals: ${signals.length ? signals.join(', ') : 'None'}
${roleContext ? `\n${roleContext}` : ''}
${recruiter?.full_name ? `\nRECRUITER\nName: ${recruiter.full_name}` : ''}

Return only the message text. Plain text, no labels, no quotes around it. 300 characters or fewer.`

  return [{ role: 'user', content: prompt }]
}

function formatComp(min, max, type) {
  if (!min && !max) return null
  const fmt = n => `$${Number(n).toLocaleString()}`
  const range = (min && max)
    ? `${fmt(min)}-${fmt(max)}`
    : min ? `${fmt(min)}+` : `Up to ${fmt(max)}`
  const suffixes = { salary: '/yr', hourly: '/hr', contract: '/yr', equity_plus_salary: '/yr + equity' }
  return `${range}${suffixes[type] ?? ''}`
}
