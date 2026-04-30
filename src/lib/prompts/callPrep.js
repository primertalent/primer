export function buildCallPrepMessages(prepType, { candidate, pipelineEntry, debriefs, interactions }) {
  const configs = {
    prep_interview: {
      label: 'Pre-interview prep',
      goal: 'Get the candidate in the best position to perform — surface any gaps, confirm they know the process, and understand what they\'re walking in thinking.',
    },
    lock_comp: {
      label: 'Lock comp expectations',
      goal: 'Walk away with: current base, target total comp, any competing offers and their status, and what it takes to get a yes.',
    },
    prep_counter: {
      label: 'Counter offer prep',
      goal: 'Understand the counter offer risk, pre-handle it before the offer drops, and know what the candidate would need to stay.',
    },
  }

  const cfg = configs[prepType] ?? configs.prep_interview

  const system = `You are Wren, the deal desk agent for a solo independent recruiter. Generate a pre-call brief the recruiter reads in 60 seconds before picking up the phone.

CALL PURPOSE: ${cfg.label}
CALL GOAL: ${cfg.goal}

Return ONLY this exact structure — no intro, no JSON, no markdown headers:

What I know: [1-2 sentences. What's captured: interest level, fit signals, situation. Specific, not generic.]
What's changed: [1 sentence. What's different since last touch — stage advance, new info, time elapsed, open questions.]
Goal of this call: [1 sentence. The single thing to walk away with.]
What they need to hear: [1 sentence. The one message most likely to move this deal.]
Risks to navigate: [1-2 sentences. Specific flags only — counter offer, competing offer, comp gap, cold candidate, slow HM. If no flags: "No flags in the data."]
Opener: [One human line to start the call. Conversational, not scripted.]

RULES:
- Use actual signals from debriefs and interactions. Do not invent signals.
- If a signal is missing, name the gap directly. "No comp locked yet." Not vague.
- No bullets within any field. Prose only.
- Sharp operator tone. No fluff, no hedging, no softening.
- If data is thin, state what is missing rather than hedging with vague language.`

  const name = `${candidate.first_name} ${candidate.last_name}`
  const parts = []

  parts.push(`Candidate: ${name}${candidate.current_title ? `, ${candidate.current_title}` : ''}${candidate.current_company ? ` at ${candidate.current_company}` : ''}`)

  if (pipelineEntry?.roles) {
    const r = pipelineEntry.roles
    parts.push(`Role: ${r.title}${r.clients?.name ? ` at ${r.clients.name}` : ''}`)
  }

  if (pipelineEntry) {
    parts.push(`Stage: ${pipelineEntry.current_stage}`)
    if (pipelineEntry.expected_comp) parts.push(`Expected comp: $${Number(pipelineEntry.expected_comp).toLocaleString()}`)
    else parts.push('Expected comp: not set')
    if (pipelineEntry.fit_score != null) parts.push(`AI fit score: ${Math.round(pipelineEntry.fit_score)}/100`)
    if (pipelineEntry.recruiter_score != null) parts.push(`Recruiter score: ${pipelineEntry.recruiter_score}/10`)
    if (pipelineEntry.recruiter_note) parts.push(`Recruiter note: ${pipelineEntry.recruiter_note}`)
  }

  const lastInteraction = interactions?.[0]
  if (lastInteraction) {
    const days = Math.floor((Date.now() - new Date(lastInteraction.occurred_at)) / 86400000)
    parts.push(`Last contact: ${lastInteraction.type}, ${days}d ago${lastInteraction.body ? ` — "${lastInteraction.body.slice(0, 200)}"` : ''}`)
  } else {
    parts.push('Last contact: none on record')
  }

  const recentDebriefs = (debriefs ?? []).slice(0, 3)
  if (recentDebriefs.length) {
    recentDebriefs.forEach((d, i) => {
      const label = i === 0 ? 'Latest debrief' : `Debrief ${i + 1}`
      const signals = []
      if (d.summary) signals.push(`Summary: ${d.summary.slice(0, 300)}`)
      const motiv = Array.isArray(d.motivation_signals) ? d.motivation_signals : []
      const comp  = Array.isArray(d.competitive_signals) ? d.competitive_signals : []
      const risk  = Array.isArray(d.risk_flags) ? d.risk_flags : []
      const pos   = Array.isArray(d.positive_signals) ? d.positive_signals : []
      const hm    = Array.isArray(d.hiring_manager_signals) ? d.hiring_manager_signals : []
      if (motiv.length) signals.push(`Motivation: ${motiv.join(', ')}`)
      if (comp.length)  signals.push(`Competing: ${comp.join(', ')}`)
      if (risk.length)  signals.push(`Risk flags: ${risk.join(', ')}`)
      if (pos.length)   signals.push(`Positive: ${pos.join(', ')}`)
      if (hm.length)    signals.push(`HM signals: ${hm.join(', ')}`)
      if (d.next_action) signals.push(`Next action from debrief: ${d.next_action}`)
      if (d.questions_to_ask_next?.length) {
        const qs = Array.isArray(d.questions_to_ask_next) ? d.questions_to_ask_next : [d.questions_to_ask_next]
        signals.push(`Questions to ask: ${qs.join('; ')}`)
      }
      if (signals.length) parts.push(`${label}:\n  ${signals.join('\n  ')}`)
    })
  } else {
    parts.push('Debriefs: none logged')
  }

  if (candidate.career_signals) {
    const cs = typeof candidate.career_signals === 'string'
      ? (() => { try { return JSON.parse(candidate.career_signals) } catch { return {} } })()
      : (candidate.career_signals ?? {})
    const flags = []
    if (cs.long_tenure)        flags.push('Long tenure')
    if (cs.job_hopper)         flags.push('Job hopper')
    if (cs.counter_offer_risk) flags.push('Counter offer risk')
    if (flags.length) parts.push(`Career signals: ${flags.join(', ')}`)
  }

  return {
    system,
    messages: [{ role: 'user', content: parts.join('\n') }],
    maxTokens: 500,
  }
}
