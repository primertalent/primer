import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { buildSubmittalForWren } from '../../src/lib/prompts/submissionDraft.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Shared fresh-draft generation path. Used by toolDraftSubmittal (api/wren.js)
// and api/submittal-format.js (format toggle endpoint).
// Does NOT handle revisions — revision stays in toolDraftSubmittal.
export async function buildSubmittalDraftPayload(
  { role_id, candidate_id, resume_text, mode = 'internal', format = 'bulleted', resolved_flags = '' },
  recruiter
) {
  const { data: roleData, error: roleErr } = await supabase
    .from('roles')
    .select('id, title, notes, process_steps, comp_min, comp_max, comp_type, clients(name)')
    .eq('id', role_id)
    .eq('recruiter_id', recruiter.id)
    .single()
  if (roleErr || !roleData) return { error: 'Role not found' }

  let candidateData
  if (candidate_id) {
    const { data: candidate, error: candErr } = await supabase
      .from('candidates')
      .select('id, first_name, last_name, current_title, current_company, location, skills, cv_text, career_timeline, notes, career_signals')
      .eq('id', candidate_id)
      .eq('recruiter_id', recruiter.id)
      .single()
    if (candErr || !candidate) return { error: 'Candidate not found' }

    const [{ data: interactions }, { data: pipelines }] = await Promise.all([
      supabase
        .from('interactions')
        .select('type, direction, body, occurred_at')
        .eq('candidate_id', candidate_id)
        .eq('recruiter_id', recruiter.id)
        .order('occurred_at', { ascending: false })
        .limit(5),
      supabase
        .from('pipelines')
        .select('id, current_stage, fit_score, roles(id)')
        .eq('candidate_id', candidate_id)
        .eq('recruiter_id', recruiter.id)
        .not('current_stage', 'in', '(placed,lost)'),
    ])

    candidateData = {
      ...candidate,
      recent_interactions: interactions || [],
      active_pipelines: pipelines || [],
    }
  } else if (resume_text) {
    candidateData = {
      first_name: 'Candidate', last_name: '(pasted)',
      current_title: null, current_company: null, location: null,
      skills: [], cv_text: resume_text, career_timeline: [], notes: null,
      recent_interactions: [], _from_paste: true,
    }
  } else {
    return { error: 'Provide candidate_id or resume_text' }
  }

  const { data: voiceSamples } = await supabase
    .from('voice_samples')
    .select('channel, subject, body')
    .eq('recruiter_id', recruiter.id)
    .in('channel', ['email', 'linkedin'])
    .limit(3)

  const fitScore = candidateData.active_pipelines?.find(p => p.roles?.id === role_id)?.fit_score ?? null

  const messages = buildSubmittalForWren(candidateData, roleData, {
    mode,
    format,
    fitScore,
    resolvedFlags: resolved_flags,
    voiceSamples: voiceSamples || [],
  })

  const aiRes = await anthropic.messages.create({
    model: process.env.AI_MODEL || 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages,
  })

  const draft_text = aiRes.content[0]?.text ?? ''

  let pipeline_id = null
  if (candidate_id && !candidateData._from_paste) {
    const { data: pl } = await supabase
      .from('pipelines')
      .select('id')
      .eq('candidate_id', candidate_id)
      .eq('role_id', role_id)
      .eq('recruiter_id', recruiter.id)
      .not('current_stage', 'in', '(placed,lost)')
      .maybeSingle()
    pipeline_id = pl?.id ?? null
  }

  return {
    draft_text,
    mode,
    format,
    resolved_flags,
    from_paste: !!candidateData._from_paste,
    candidate_id: candidate_id ?? null,
    role_id,
    pipeline_id,
    candidate_name: candidateData._from_paste
      ? null
      : `${candidateData.first_name} ${candidateData.last_name}`,
    role_title: roleData.title,
    client_name: roleData.clients?.name,
    gmail_connected: !!recruiter.gmail_access_token,
    suggest_pipeline: !candidateData._from_paste && !!candidate_id,
  }
}
