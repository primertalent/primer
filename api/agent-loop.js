import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { buildAgentLoopMessages } from '../src/lib/prompts/agentLoop.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Service role key bypasses RLS — required for server-side cross-recruiter reads.
// Add SUPABASE_SERVICE_ROLE_KEY to Vercel env vars (keep it out of the client bundle).
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Note: Vercel Hobby has a 10-second function timeout. maxDuration only takes effect on Pro.
// The loop uses Sonnet which typically responds in 5-8s. If timeouts occur, switch model to
// claude-haiku-4-5-20251001 (faster) or migrate the loop script into GitHub Actions directly.
export const config = {
  maxDuration: 60,
}

export default async function handler(req, res) {
  const auth = req.headers['authorization']
  if (!auth || auth !== `Bearer ${process.env.AGENT_LOOP_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const sourceRunId = crypto.randomUUID()

    const { data: pipelineRows, error: prErr } = await supabase
      .from('pipeline')
      .select('recruiter_id')
      .not('current_stage', 'in', '(placed,lost)')

    if (prErr) throw prErr

    const recruiterIds = [...new Set((pipelineRows || []).map(r => r.recruiter_id))]

    const summary = []
    for (const recruiterId of recruiterIds) {
      const result = await runLoopForRecruiter(recruiterId, sourceRunId)
      summary.push(result)
    }

    return res.status(200).json({ ok: true, source_run_id: sourceRunId, recruiters: summary })
  } catch (err) {
    console.error('[agent-loop] error:', err)
    return res.status(500).json({ error: err.message })
  }
}

async function runLoopForRecruiter(recruiterId, sourceRunId) {
  // ── Pass 1: active pipeline + candidate + role + client ──
  const { data: pipelines, error: pErr } = await supabase
    .from('pipeline')
    .select(`
      id, current_stage, fit_score, next_action, next_action_due_at,
      expected_comp, submitted_at, last_followup_at,
      candidates ( id, first_name, last_name, current_title, current_company, career_signals ),
      roles (
        id, title, status, placement_fee_pct, placement_fee_flat,
        target_comp_min, target_comp_max, openings, agreement_status,
        clients ( name )
      )
    `)
    .eq('recruiter_id', recruiterId)
    .not('current_stage', 'in', '(placed,lost)')

  if (pErr) throw pErr

  // Filter to roles that are active (PostgREST doesn't support nested WHERE cleanly)
  const activePipelines = (pipelines || []).filter(p => p.roles?.status === 'active')
  if (!activePipelines.length) return { recruiter_id: recruiterId, actions_written: 0 }

  const pipelineIds = activePipelines.map(p => p.id)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // ── Pass 2: interactions, debriefs, stage history (batch) ─
  const [
    { data: interactions },
    { data: debriefs },
    { data: stageHistory },
  ] = await Promise.all([
    supabase
      .from('interactions')
      .select('pipeline_id, type, body, created_at')
      .in('pipeline_id', pipelineIds)
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false }),
    supabase
      .from('debriefs')
      .select('pipeline_id, outcome, summary, motivation_signals, competitive_signals, risk_flags, created_at')
      .in('pipeline_id', pipelineIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('pipeline_stage_history')
      .select('pipeline_id, stage, entered_at')
      .in('pipeline_id', pipelineIds)
      .order('entered_at', { ascending: false }),
  ])

  const byPipeline = (rows, key) => (rows || []).reduce((acc, row) => {
    const k = row[key]
    if (!acc[k]) acc[k] = []
    acc[k].push(row)
    return acc
  }, {})

  const interactionsByPipeline = byPipeline(interactions, 'pipeline_id')
  const debriefsByPipeline     = byPipeline(debriefs, 'pipeline_id')
  const historyByPipeline      = byPipeline(stageHistory, 'pipeline_id')
  const now                    = Date.now()

  const enrichedPipelines = activePipelines.map(p => {
    const latestStage = historyByPipeline[p.id]?.[0]
    const enteredAt   = latestStage?.entered_at ? new Date(latestStage.entered_at).getTime() : null
    const daysInStage = enteredAt != null ? Math.floor((now - enteredAt) / 86400000) : null

    return {
      id:                 p.id,
      candidate_name:     [p.candidates?.first_name, p.candidates?.last_name].filter(Boolean).join(' ') || null,
      candidate_title:    p.candidates?.current_title,
      candidate_company:  p.candidates?.current_company,
      career_signals:     p.candidates?.career_signals,
      role_title:         p.roles?.title,
      client_name:        p.roles?.clients?.name,
      current_stage:      p.current_stage,
      days_in_stage:      daysInStage,
      fit_score:          p.fit_score,
      expected_comp:      p.expected_comp,
      placement_fee_pct:  p.roles?.placement_fee_pct,
      next_action:        p.next_action,
      next_action_due_at: p.next_action_due_at,
      submitted_at:       p.submitted_at,
      last_followup_at:   p.last_followup_at,
      recent_interactions: (interactionsByPipeline[p.id] || []).slice(0, 3),
      latest_debrief:      (debriefsByPipeline[p.id]     || [])[0] ?? null,
      stage_history:       (historyByPipeline[p.id]      || []).slice(0, 4),
    }
  })

  // ── Call agent loop prompt ────────────────────────────────
  const { system, messages, maxTokens } = buildAgentLoopMessages({ pipelines: enrichedPipelines })

  const aiResponse = await anthropic.messages.create({
    model: process.env.AI_MODEL || 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system,
    messages,
  })

  const raw     = aiResponse.content[0]?.text ?? ''
  const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()

  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    console.error('[agent-loop] JSON parse failed for recruiter', recruiterId, raw.slice(0, 200))
    return { recruiter_id: recruiterId, actions_written: 0, parse_error: true }
  }

  const allActions = [
    ...(parsed.active_actions  || []),
    ...(parsed.sharpening_asks || []),
  ]

  // ── Write to actions table (idempotent via content_hash) ──
  let written = 0
  for (const action of allActions) {
    const hashStr    = `${recruiterId}:${action.linked_entity_id ?? ''}:${action.action_type}:${action.suggested_next_step ?? ''}`
    const contentHash = crypto.createHash('sha256').update(hashStr).digest('hex')

    // Skip if an undismissed, unacted duplicate already exists
    const { data: existing } = await supabase
      .from('actions')
      .select('id')
      .eq('content_hash', contentHash)
      .is('dismissed_at', null)
      .is('acted_on_at', null)
      .maybeSingle()

    if (existing) continue

    const { error: insertErr } = await supabase.from('actions').insert({
      recruiter_id:        recruiterId,
      action_type:         action.action_type,
      linked_entity_id:    action.linked_entity_id ?? null,
      linked_entity_type:  action.linked_entity_type ?? null,
      urgency:             action.urgency || 'this_week',
      why:                 action.why ?? null,
      suggested_next_step: action.suggested_next_step ?? null,
      confidence:          action.confidence ?? null,
      content_hash:        contentHash,
      source_run_id:       sourceRunId,
    })

    if (insertErr) {
      console.warn('[agent-loop] insert error:', insertErr.message)
    } else {
      written++
    }
  }

  return { recruiter_id: recruiterId, actions_written: written }
}
