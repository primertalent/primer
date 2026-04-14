export function buildCandidatePitchMessages(candidate, role) {
  const skills = candidate.skills?.join(', ') || 'None listed'

  const signalsSection = candidate.career_signals?.length
    ? `\nCAREER SIGNALS: ${candidate.career_signals.join(', ')}`
    : ''

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

  const jdSection = role.notes
    ? `\nJOB DESCRIPTION:\n${role.notes}`
    : ''

  const prompt = `You are a submission specialist who has placed 1,000+ candidates. You write pitches that make hiring managers say "Yes, let's interview" — not "maybe later." You understand hiring managers see 100+ pitches a week, most are generic copy-paste, and they need to be sold on why THIS person specifically — not just that a candidate exists.

Core principles:
- Proof over promise. "Has done this before at scale" beats "could probably do this"
- Specific numbers beat generic claims: revenue, team size, percentages, timeframes, user counts
- Show, don't tell. Replace "great at scaling teams" with "grew engineering from 3 to 15 people, all 12 original hires still there"
- Use active verbs: led, built, shipped, scaled, grew, owned, closed, designed
- Cut all adjectives: dynamic, passionate, hard-working, results-driven, self-starter — these are implied by evidence or meaningless without it
- Never write: "top performer", "strong communicator", "passionate about", "proven track record", "self-starter"
- Anticipate hiring manager objections and address them inside the pitch before they form
- Weave in the candidate's growth trajectory, career signals, and upward movement where the data supports it

Objection-handling patterns to use when relevant:
- Overqualified → "He's turned down VP roles at larger companies to join high-impact companies at this stage"
- First time in this exact role → "While she hasn't done X specifically, she's done Y and Z which are 80% the same skill set. At [Company], she picked up X in 3 months"
- Tenure concern → Lead with their actual tenure history: "5-year, 4-year, 6-year tenures — not a resume builder"
- Cost concern → Frame as cost-to-value: "She'll pay for herself in [timeframe] given [specific achievement]"

Write exactly 3 paragraphs of plain text. No headers, no bullet points, no markdown. Total pitch: 5-7 sentences.

PARAGRAPH 1 — CREDIBILITY HOOK (2-3 sentences)
Open with the single most impressive, credible, quantified achievement from this candidate's background. This must make the hiring manager want to keep reading. Lead with what's surprising or remarkable. If career signals are present (Promoted, Fast Riser, Quota Buster, President's Club), use the one that best supports the hook. The first sentence must contain a specific number, company name, or concrete outcome — never an adjective.

PARAGRAPH 2 — SPECIFIC FIT (3-4 sentences)
Map the candidate's experience directly to what this role requires. Use this structure: "You need someone who can [requirement] — they've done exactly this at [company] where [specific example with proof]." Cover the 2-3 most important role requirements. If there's an obvious objection a hiring manager would have (gap, no direct industry experience, first time at this level), address it with evidence here. Never make the hiring manager connect the dots themselves.

PARAGRAPH 3 — WHY NOW / CLOSE (2 sentences)
Explain why this candidate is available and why this role is their next move — not just a job they applied to. Frame from the candidate's perspective: what they want to own next and why this specific opportunity is that. End with a direct, low-friction invitation to meet. Be confident: "I think she's your person. Want to chat this week?" not "Let me know if you're interested."

CANDIDATE
Name: ${candidate.first_name} ${candidate.last_name}
Current: ${candidate.current_title ?? 'Unknown'} at ${candidate.current_company ?? 'Unknown'}
Location: ${candidate.location ?? 'Not specified'}
Skills: ${skills}${signalsSection}${timelineSection}${cvSection}

ROLE
Title: ${role.title}
Client: ${role.clients?.name ?? 'Unknown'}${jdSection}

Return only the three paragraphs. No subject line, no salutation, no sign-off, no labels, no headers.`

  return [{ role: 'user', content: prompt }]
}
