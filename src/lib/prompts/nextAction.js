const SOURCE_LABELS = {
  sourced: 'Sourced',
  inbound: 'Inbound',
  referral: 'Referral',
  job_board: 'Job Board',
  other: 'Other',
}

const TYPE_LABELS = {
  email: 'Email',
  linkedin: 'LinkedIn',
  text: 'Text',
  call: 'Call',
  note: 'Note',
  meeting: 'Meeting',
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDateShort(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function buildNextActionMessages(candidate, pipelines, interactions) {
  const skills = candidate.skills?.join(', ') || 'None listed'

  const pipelineSection = pipelines.length
    ? pipelines.map(p => `
  Role: ${p.roles?.title ?? 'Unknown'} at ${p.roles?.clients?.name ?? 'Unknown client'}
  Stage: ${p.current_stage}
  Status: ${p.status}
  Fit Score: ${p.fit_score != null ? `${p.fit_score}/100` : 'Not scored'}
  Fit Rationale: ${p.fit_score_rationale || 'None'}
  Next Action: ${p.next_action || 'None set'}
  Next Action Due: ${p.next_action_due_at ? formatDateShort(p.next_action_due_at) : 'None'}`).join('\n')
    : '  Not in any active pipeline.'

  const historySection = interactions.length
    ? interactions.map(i => `
  [${formatDate(i.occurred_at)}] ${TYPE_LABELS[i.type] ?? i.type}${i.direction ? ` (${i.direction})` : ''}
  ${i.subject ? `Subject: ${i.subject}` : ''}
  ${i.body ?? '(no body)'}`).join('\n')
    : '  No interactions recorded yet.'

  const prompt = `You are a recruiting intelligence assistant for Wren, a recruiting OS for independent recruiters.

Analyze the following candidate profile and their full interaction history, then recommend the single most important next action the recruiter should take. Be specific, actionable, and concise. If a message needs to be sent, include suggested talking points or a brief draft.

CANDIDATE PROFILE
Name: ${candidate.first_name} ${candidate.last_name}
Current Role: ${candidate.current_title ?? 'Unknown'} at ${candidate.current_company ?? 'Unknown'}
Location: ${candidate.location ?? 'Unknown'}
Email: ${candidate.email ?? 'Not provided'}
Phone: ${candidate.phone ?? 'Not provided'}
LinkedIn: ${candidate.linkedin_url ?? 'Not provided'}
Skills: ${skills}
Source: ${SOURCE_LABELS[candidate.source] ?? candidate.source}
Notes: ${candidate.notes || 'None'}

PIPELINE STATUS
${pipelineSection}

INTERACTION HISTORY
${historySection}

Based on everything above, what is the single most important next action the recruiter should take right now?`

  return [{ role: 'user', content: prompt }]
}
