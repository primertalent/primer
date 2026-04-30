// Returns a single integer 1-10. maxTokens: 10. Fast classification call.
export function buildConfidenceScoreMessages(moment, { candidate, pipelineEntry, debriefs, interactions }) {
  const system = `You are a recruiting deal desk AI. Rate your confidence this candidate will be placed in this role.

Return ONLY a single integer between 1 and 10. No explanation, no punctuation, nothing else.`

  const parts = []
  parts.push(`Candidate: ${candidate.first_name} ${candidate.last_name}${candidate.current_title ? `, ${candidate.current_title}` : ''}`)

  if (pipelineEntry?.roles) parts.push(`Role: ${pipelineEntry.roles.title}`)
  if (pipelineEntry?.current_stage) parts.push(`Stage: ${pipelineEntry.current_stage}`)
  if (pipelineEntry?.fit_score != null) parts.push(`AI fit score: ${Math.round(pipelineEntry.fit_score)}/100`)
  if (pipelineEntry?.expected_comp) parts.push(`Expected comp: $${Number(pipelineEntry.expected_comp).toLocaleString()}`)

  const latestDebrief = debriefs?.[0]
  if (latestDebrief) {
    const motiv = Array.isArray(latestDebrief.motivation_signals) ? latestDebrief.motivation_signals : []
    const risk  = Array.isArray(latestDebrief.risk_flags) ? latestDebrief.risk_flags : []
    const comp  = Array.isArray(latestDebrief.competitive_signals) ? latestDebrief.competitive_signals : []
    const pos   = Array.isArray(latestDebrief.positive_signals) ? latestDebrief.positive_signals : []
    if (motiv.length) parts.push(`Motivation: ${motiv.join(', ')}`)
    if (risk.length)  parts.push(`Risk flags: ${risk.join(', ')}`)
    if (comp.length)  parts.push(`Competing: ${comp.join(', ')}`)
    if (pos.length)   parts.push(`Positive: ${pos.join(', ')}`)
    if (latestDebrief.summary) parts.push(`Debrief summary: ${latestDebrief.summary.slice(0, 300)}`)
  } else {
    parts.push('No debriefs logged')
  }

  const lastInteraction = interactions?.[0]
  if (lastInteraction) {
    const days = Math.floor((Date.now() - new Date(lastInteraction.occurred_at)) / 86400000)
    parts.push(`Last contact: ${lastInteraction.type}, ${days}d ago`)
  }

  const context = moment === 'post'
    ? 'Post-call rating. Use the debrief signals above to calibrate.'
    : 'Pre-call rating. Use signals captured so far.'

  return {
    system,
    messages: [{ role: 'user', content: `${context}\n\n${parts.join('\n')}` }],
    maxTokens: 10,
  }
}
