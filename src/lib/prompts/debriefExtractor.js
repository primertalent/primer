// Takes a raw debrief input (transcript, voice notes, brain dump) and candidate/role context.
// Returns structured signal JSON for storage and display.
export function buildDebriefExtractorMessages(candidate, role, stage, priorDebriefs, rawInput) {
  const stageLine = stage ? `Current Stage: ${stage}` : ''

  const priorSection = priorDebriefs?.length
    ? `PRIOR DEBRIEFS (${priorDebriefs.length} total, most recent first):\n${
        priorDebriefs.slice(0, 3).map(d =>
          `[${d.captured_at?.slice(0, 10)}] Outcome: ${d.outcome}. ${d.summary ?? ''}`
        ).join('\n')
      }`
    : 'PRIOR DEBRIEFS: None'

  const roleLine = role ? `Role: ${role.title}${role.clients?.name ? ` at ${role.clients.name}` : ''}` : 'Role: Unknown'

  const prompt = `You are Wren, an agent that works the desk of an independent recruiter. You are reading a raw debrief note from a recruiter — this could be a pasted Zoom or Fathom transcript, a Granola note, or a freeform brain dump typed right after a call.

Your job is to extract structured recruiting signal from the noise. Be specific. Pull exact quotes or paraphrases where they exist. If something wasn't covered, say so. Do not invent. Do not generalize.

CANDIDATE
Name: ${candidate.first_name} ${candidate.last_name}
Current: ${candidate.current_title ?? 'Unknown'} at ${candidate.current_company ?? 'Unknown'}
${roleLine}
${stageLine}

${priorSection}

RAW DEBRIEF INPUT:
${rawInput.slice(0, 8000)}

Extract and return ONLY a valid JSON object — no markdown, no explanation:
{
  "summary": "<2 sentences, Slack-ready. What happened on this call and what does it mean for the deal. Specific, no filler.>",
  "motivation_signals": ["<what the candidate said about why they'd leave, what they want, what they're avoiding — one item per signal>"],
  "competitive_signals": ["<other companies mentioned, stage of other processes, comp expectations, timing pressure — one item per signal>"],
  "risk_flags": ["<anything suggesting counter-offer risk, hesitation, misalignment, stalled interest, or red flags — one item per flag>"],
  "positive_signals": ["<energy, specific excitement, questions they asked, cultural fit signals, strong indicators — one item per signal>"],
  "hiring_manager_signals": ["<if the candidate mentioned the HM, interview experience, or client feedback — one item per signal. Empty array if none mentioned.>"],
  "next_action": "<specific recommended next move based on this debrief — one sentence, recruiter-voice>",
  "questions_to_ask_next": ["<what wasn't covered that should be surfaced next interaction — one question per item>"],
  "updates_to_record": ["<specific fields on the candidate or pipeline record that should be updated based on new info, e.g. 'Update comp expectation to $180k base', 'Note competing offer from Stripe at Series B' — one update per item>"]
}

Writing rules:
- No em dashes or en dashes. Use periods or commas.
- No AI filler: "Additionally", "Furthermore", "It is worth noting", "leveraged", "spearheaded"
- Sound like a recruiter talking to a colleague. Direct. Specific.
- If data is thin or ambiguous, say so in the relevant field rather than guessing.
- Empty arrays are valid if a category has no signal.`

  return [{ role: 'user', content: prompt }]
}
