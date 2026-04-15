export function buildDailyBriefMessages({ overdue, dueToday, pipeline, stats }) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const overdueSection = overdue.length
    ? overdue.map(p =>
        `- ${p.candidates.first_name} ${p.candidates.last_name} — ${p.roles?.title ?? 'Unknown role'} (${p.current_stage}) — overdue: ${p.next_action || 'no action set'}`
      ).join('\n')
    : null

  const dueTodaySection = dueToday.length
    ? dueToday.map(p =>
        `- ${p.candidates.first_name} ${p.candidates.last_name} — ${p.roles?.title ?? 'Unknown role'} (${p.current_stage}) — due today: ${p.next_action || 'no action set'}`
      ).join('\n')
    : null

  const pipelineSummary = pipeline.length
    ? `${pipeline.length} active candidates across ${stats.activeRoles} open roles`
    : 'No active pipeline yet'

  const sections = [
    `Today is ${today}.`,
    `Pipeline: ${pipelineSummary}. ${stats.messagesToReview} draft${stats.messagesToReview !== 1 ? 's' : ''} pending in queue.`,
    overdueSection ? `Overdue actions:\n${overdueSection}` : null,
    dueTodaySection ? `Due today:\n${dueTodaySection}` : null,
  ].filter(Boolean).join('\n\n')

  const prompt = `You are Wren, a recruiting OS for a solo independent recruiter. Write a brief morning brief based on the data below.

Rules:
- 2-3 sentences max. Plain text, no markdown.
- Lead with what needs attention right now — overdue actions first, then today's priorities.
- If nothing is urgent, say so clearly and point to the highest-value next move.
- Sound like a sharp colleague giving a 30-second morning rundown. Not a bot, not a report.
- No em dashes, no AI writing tells, no filler.

DATA:
${sections}

Write the brief now. 2-3 sentences.`

  return [{ role: 'user', content: prompt }]
}
