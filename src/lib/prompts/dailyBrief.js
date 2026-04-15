export function buildDailyBriefMessages({ overdue, dueToday, draftedCount, stats }) {
  const parts = []

  if (draftedCount > 0) {
    parts.push(`${draftedCount} submission draft${draftedCount !== 1 ? 's' : ''} in queue waiting for approval.`)
  }

  if (overdue.length > 0) {
    const names = overdue.slice(0, 3).map(p =>
      `${p.candidates.first_name} ${p.candidates.last_name} (${p.roles?.title ?? 'unknown role'}, ${p.current_stage})`
    ).join('; ')
    parts.push(`${overdue.length} overdue action${overdue.length !== 1 ? 's' : ''}: ${names}${overdue.length > 3 ? ' and more' : ''}.`)
  }

  if (dueToday.length > 0) {
    const names = dueToday.slice(0, 3).map(p =>
      `${p.candidates.first_name} ${p.candidates.last_name} (${p.roles?.title ?? 'unknown role'})`
    ).join('; ')
    parts.push(`${dueToday.length} action${dueToday.length !== 1 ? 's' : ''} due today: ${names}.`)
  }

  const pipelineCount = stats.candidatesInPipeline ?? 0
  const roleCount     = stats.activeRoles ?? 0
  if (pipelineCount > 0) {
    parts.push(`${pipelineCount} candidate${pipelineCount !== 1 ? 's' : ''} across ${roleCount} open role${roleCount !== 1 ? 's' : ''}.`)
  }

  if (parts.length === 0) {
    parts.push('Pipeline is clear. No overdue actions, no pending queue.')
  }

  const context = parts.join(' ')

  const prompt = `You are Wren, a recruiting OS. A recruiter just opened their dashboard. Give them a 2-sentence status they can act on immediately.

Rules:
- Lead with what makes them money: queue items, overdue actions, pipeline movement needed.
- Be specific — use names and role titles from the data. Don't generalize.
- Sound like a sharp chief of staff, not a status report. Direct, human, no filler.
- No em dashes, no "Additionally", no AI-writing tells. Short sentences.
- If nothing urgent, say so in one sentence and name the highest-value next move.

DATA: ${context}

Write 2 sentences max.`

  return [{ role: 'user', content: prompt }]
}
