export function buildAgentLoopMessages(deskState) {
  const system = `You are the autonomous agent loop for Wren, a deal desk for solo independent recruiters. You run every 4 hours and scan the recruiter's active desk.

Your job: reason like a senior recruiter reviewing their pipeline. Not rule-based. Pattern-aware. Surface what genuinely needs attention, what's at risk, and what data gaps are limiting your read on specific deals.

Return ONLY valid JSON in this exact shape:
{
  "active_actions": [
    {
      "action_type": "string",
      "linked_entity_id": "pipeline-uuid",
      "linked_entity_type": "pipeline",
      "urgency": "string",
      "why": "string",
      "suggested_next_step": "string",
      "confidence": "string"
    }
  ],
  "sharpening_asks": [
    {
      "action_type": "sharpening_ask",
      "linked_entity_id": "uuid",
      "linked_entity_type": "string",
      "urgency": "string",
      "why": "string",
      "suggested_next_step": "string",
      "confidence": "string"
    }
  ]
}

ACTIVE ACTION TYPES:
- follow_up_overdue: submission or candidate has gone quiet and follow-up is overdue
- risk_flag: counter offer risk, thin motivation, competing offer, stalled deal, cold client
- missing_data: expected comp missing at late stage, fee not set, no debrief after interview
- opportunity: strong candidate ready to submit, right timing for a close move
- stage_check: stage advance is overdue or likely expected based on timeline and interactions
- relationship_warm: good moment for a light check-in without a specific ask
- mcp_opportunity: candidate is strong enough to pitch speculatively to other clients

URGENCY:
- "now": deal is at immediate risk or action is time-sensitive today
- "today": should happen today
- "this_week": needs attention this week

CONFIDENCE: "high" | "medium" | "low"

REASONING RULES:
- Read patterns across the full desk, not just individual deals in isolation
- Stalled is not "days in stage > N". Stalled is stage velocity slowing without explanation while interactions stay warm — that pattern points to a client-side process issue, not candidate interest
- Thin motivation data is a risk flag at late_stage and offer, not at first_stage or middle_stage
- Flag missing expected_comp when stage is middle_stage or beyond
- "Submitted 5 days ago, no follow-up interaction logged" is a real signal. Track it
- If the last debrief shows active risk_flags and the stage just advanced, that warrants a flag
- Sharpening asks must be tied to a specific deal payoff — "log a debrief on this call to give me a read before the final round" not "add more data"
- Graceful degradation: produce useful output even on thin data. Day-one user with a few pasted pipelines still gets stage-aware suggestions

LIMITS:
- Max 6 active_actions per run (highest urgency and confidence first)
- Max 3 sharpening_asks per run (most impactful gaps only)
- why and suggested_next_step: 1-2 sentences, specific and contextual, no hedging
- Do not generate duplicate actions for the same pipeline
- If the desk is empty or all data is very thin, return empty arrays rather than low-signal noise`

  const contextBlock = deskState.pipelines.length === 0
    ? 'No active pipeline entries.'
    : deskState.pipelines.map(p => formatPipelineContext(p)).join('\n\n')

  const message = `Desk scan — ${new Date().toISOString()}
Active pipelines: ${deskState.pipelines.length}

${contextBlock}`

  return {
    system,
    messages: [{ role: 'user', content: message }],
    maxTokens: 1200,
  }
}

function formatPipelineContext(p) {
  const lines = [
    `--- DEAL [pipeline_id: ${p.id}] ---`,
    `Candidate: ${p.candidate_name || 'Unknown'}${p.candidate_title ? ` — ${p.candidate_title}${p.candidate_company ? ` at ${p.candidate_company}` : ''}` : ''}`,
    `Role: ${p.role_title || 'Unknown role'} at ${p.client_name || 'Unknown client'}`,
    `Stage: ${p.current_stage}${p.days_in_stage != null ? ` (${p.days_in_stage}d in stage)` : ''}`,
  ]

  if (p.fit_score) lines.push(`AI fit score: ${p.fit_score}/100`)
  if (p.expected_comp) lines.push(`Expected comp: $${Number(p.expected_comp).toLocaleString()}`)
  if (p.placement_fee_pct) lines.push(`Fee: ${parseFloat((p.placement_fee_pct * 100).toFixed(4))}%`)
  if (!p.expected_comp) lines.push('Expected comp: not set')

  if (p.next_action) {
    const due = p.next_action_due_at ? ` (due ${p.next_action_due_at.slice(0, 10)})` : ''
    lines.push(`Next action: ${p.next_action}${due}`)
  }
  if (p.submitted_at) lines.push(`Submitted: ${p.submitted_at.slice(0, 10)}`)
  if (p.last_followup_at) lines.push(`Last follow-up: ${p.last_followup_at.slice(0, 10)}`)

  if (p.stage_history?.length) {
    const history = p.stage_history
      .map(s => `${s.stage} (${s.entered_at?.slice(0, 10)})`)
      .join(' → ')
    lines.push(`Stage history: ${history}`)
  }

  if (p.recent_interactions?.length) {
    const latest = p.recent_interactions[0]
    const body = latest.body ? ` — "${latest.body.slice(0, 200)}"` : ''
    lines.push(`Recent interactions (7d): ${p.recent_interactions.length} — latest: ${latest.type} on ${latest.created_at?.slice(0, 10)}${body}`)
  } else {
    lines.push('Recent interactions (7d): none')
  }

  if (p.latest_debrief) {
    const d = p.latest_debrief
    lines.push(`Latest debrief (${d.created_at?.slice(0, 10)}): outcome=${d.outcome || 'not set'}`)
    if (d.summary) lines.push(`  Summary: ${d.summary.slice(0, 300)}`)
    const motiv = Array.isArray(d.motivation_signals) ? d.motivation_signals : []
    const comp  = Array.isArray(d.competitive_signals) ? d.competitive_signals : []
    const risk  = Array.isArray(d.risk_flags) ? d.risk_flags : []
    if (motiv.length) lines.push(`  Motivation: ${motiv.slice(0, 3).join(', ')}`)
    if (comp.length)  lines.push(`  Competing: ${comp.slice(0, 3).join(', ')}`)
    if (risk.length)  lines.push(`  Risk flags: ${risk.slice(0, 3).join(', ')}`)
  } else {
    lines.push('Latest debrief: none')
  }

  if (p.career_signals) {
    const signals = typeof p.career_signals === 'string'
      ? (() => { try { return JSON.parse(p.career_signals) } catch { return {} } })()
      : p.career_signals
    const flagged = []
    if (signals.long_tenure)        flagged.push('Long tenure')
    if (signals.job_hopper)         flagged.push('Job hopper')
    if (signals.counter_offer_risk) flagged.push('Counter offer risk')
    if (flagged.length) lines.push(`Candidate signals: ${flagged.join(', ')}`)
  }

  return lines.join('\n')
}
