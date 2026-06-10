import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { buildAgentLoopMessages } from '../../src/lib/prompts/agentLoop.js'
import { BUILD_VERSION } from '../../src/lib/buildVersion.js'

// Shared supabase + anthropic instances for server-side loop execution.
// Service role key bypasses RLS — never expose client-side.
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const URGENCY_RANK = { now: 3, today: 2, this_week: 1 }

export async function runLoopForRecruiter(recruiterId, sourceRunId) {
  // ── Pass 1: active pipeline + candidate + role + client ──
  const { data: pipelines, error: pErr } = await supabase
    .from('pipelines')
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

  const activePipelines = (pipelines || []).filter(p => p.roles?.status !== 'closed')
  if (!activePipelines.length) return { recruiter_id: recruiterId, pipelines_found: 0, actions_written: 0 }

  const pipelineIds = activePipelines.map(p => p.id)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // ── Pass 2: interactions, debriefs, stage history (batch) ──
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
      id:                  p.id,
      candidate_name:      [p.candidates?.first_name, p.candidates?.last_name].filter(Boolean).join(' ') || null,
      candidate_title:     p.candidates?.current_title,
      candidate_company:   p.candidates?.current_company,
      career_signals:      p.candidates?.career_signals,
      role_title:          p.roles?.title,
      client_name:         p.roles?.clients?.name,
      current_stage:       p.current_stage,
      days_in_stage:       daysInStage,
      fit_score:           p.fit_score,
      expected_comp:       p.expected_comp,
      placement_fee_pct:   p.roles?.placement_fee_pct,
      next_action:         p.next_action,
      next_action_due_at:  p.next_action_due_at,
      submitted_at:        p.submitted_at,
      last_followup_at:    p.last_followup_at,
      recent_interactions: (interactionsByPipeline[p.id] || []).slice(0, 3),
      latest_debrief:      (debriefsByPipeline[p.id]     || [])[0] ?? null,
      stage_history:       (historyByPipeline[p.id]      || []).slice(0, 4),
    }
  })

  // ── Call agent loop prompt ────────────────────────────────
  const { system, messages, maxTokens } = buildAgentLoopMessages({ pipelines: enrichedPipelines })

  const aiResponse = await anthropic.messages.create({
    model: process.env.AGENT_LOOP_MODEL || 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    system,
    messages,
  })

  const raw = aiResponse.content.find(b => b.type === 'text')?.text ?? ''

  let parsed = null
  const attempts = [
    raw.trim(),
    raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim(),
  ]
  for (const attempt of attempts) {
    try { parsed = JSON.parse(attempt); break } catch {}
  }
  if (!parsed) {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) try { parsed = JSON.parse(match[0]) } catch {}
  }
  if (!parsed) {
    console.error('[agent-loop-runner] JSON parse failed for recruiter', recruiterId, raw.slice(0, 300))
    return { recruiter_id: recruiterId, actions_written: 0, parse_error: true }
  }

  const allActions = [
    ...(parsed.active_actions  || []),
    ...(parsed.sharpening_asks || []),
  ]

  // ── Write to actions table (idempotent via content_hash) ──
  //
  // Batched dedup: one upfront SELECT replaces N per-action SELECTs, cutting
  // up to 18 sequential DB round-trips (for 6 actions) down to 3.
  //
  // Two dedup checks:
  //   1. Content hash  — skip if any undismissed row (including acted-on) has the same hash.
  //      Preserves the invariant that completed actions block re-generation.
  //   2. Pipeline urgency — for pipeline-linked actions, skip if an active undismissed/
  //      non-snoozed row at equal-or-higher urgency already exists; delete it if incoming
  //      is strictly higher. One stale row deleted per pipeline_id at most.
  //   3. Pending hash  — catch within-run duplicates before they reach the DB.
  //      The prompt enforces one action per pipeline row but that is a model instruction,
  //      not a guarantee. Haiku could return malformed output that parses into duplicates.

  const nowIso = new Date().toISOString()

  // Compute all content hashes upfront (no DB).
  const actionsWithHashes = allActions.map(action => ({
    ...action,
    contentHash: crypto.createHash('sha256')
      .update(`${recruiterId}:${action.linked_entity_id ?? ''}:${action.action_type}:${action.suggested_next_step ?? ''}`)
      .digest('hex'),
  }))

  // One SELECT: all undismissed rows for this recruiter.
  // Includes acted-on rows so the content hash check can suppress re-generation of completed cards.
  const { data: existingActions, error: fetchErr } = await supabase
    .from('actions')
    .select('id, content_hash, linked_entity_id, linked_entity_type, urgency, acted_on_at, snoozed_until')
    .eq('recruiter_id', recruiterId)
    .is('dismissed_at', null)

  if (fetchErr) {
    console.warn('[agent-loop-runner] existing actions fetch error:', fetchErr.message)
  }

  // Build lookup structures from the fetched rows.
  const existingHashSet = new Set((existingActions || []).map(r => r.content_hash).filter(Boolean))

  // For pipeline urgency dedup: only active rows (not acted-on, not currently snoozed).
  const existingPipelineMap = new Map() // linked_entity_id → row
  for (const row of (existingActions || [])) {
    if (row.acted_on_at) continue
    if (row.snoozed_until && row.snoozed_until > nowIso) continue
    if (row.linked_entity_type === 'pipeline' && row.linked_entity_id) {
      const prior = existingPipelineMap.get(row.linked_entity_id)
      if (!prior || (URGENCY_RANK[row.urgency] ?? 0) > (URGENCY_RANK[prior.urgency] ?? 0)) {
        existingPipelineMap.set(row.linked_entity_id, row)
      }
    }
  }

  // Walk incoming actions and decide what to delete / insert.
  const staleIdsToDelete = []
  const rowsToInsert     = []
  const pendingHashes    = new Set() // within-run duplicate guard

  for (const action of actionsWithHashes) {
    // Check 1: content hash dedup (DB rows + already-queued rows this run).
    if (existingHashSet.has(action.contentHash)) continue
    if (pendingHashes.has(action.contentHash))   continue

    // Check 2: pipeline urgency dedup.
    if (action.linked_entity_type === 'pipeline' && action.linked_entity_id) {
      const existingRow = existingPipelineMap.get(action.linked_entity_id)
      if (existingRow) {
        const incomingRank = URGENCY_RANK[action.urgency] ?? 0
        const existingRank = URGENCY_RANK[existingRow.urgency] ?? 0
        if (incomingRank <= existingRank) continue
        staleIdsToDelete.push(existingRow.id)
        // Update the map so a second incoming action on the same pipeline_id
        // sees the new state rather than the now-stale DB row.
        existingPipelineMap.set(action.linked_entity_id, { ...existingRow, urgency: action.urgency })
      }
    }

    pendingHashes.add(action.contentHash)
    rowsToInsert.push({
      recruiter_id:        recruiterId,
      action_type:         action.action_type,
      linked_entity_id:    action.linked_entity_id ?? null,
      linked_entity_type:  action.linked_entity_type ?? null,
      urgency:             action.urgency || 'this_week',
      why:                 action.why ?? null,
      suggested_next_step: action.suggested_next_step ?? null,
      confidence:          action.confidence ?? null,
      content_hash:        action.contentHash,
      source_run_id:       sourceRunId,
      build_version:       BUILD_VERSION,
    })
  }

  // Batch DELETE stale lower-urgency pipeline rows (0 or 1 query).
  if (staleIdsToDelete.length > 0) {
    const { error: deleteErr } = await supabase
      .from('actions')
      .delete()
      .in('id', staleIdsToDelete)
    if (deleteErr) {
      console.warn('[agent-loop-runner] batch delete error:', deleteErr.message)
    }
  }

  // Batch INSERT new rows (0 or 1 query).
  // Atomic: all rows succeed or all fail. On failure, log per-row context so
  // the offending row can be identified without re-running.
  let written = 0
  if (rowsToInsert.length > 0) {
    const { error: insertErr } = await supabase.from('actions').insert(rowsToInsert)
    if (insertErr) {
      const rowSummary = rowsToInsert.map(r =>
        `{type:${r.action_type} pipeline:${r.linked_entity_id ?? 'none'} hash:${r.content_hash?.slice(0, 8)}}`
      ).join(', ')
      console.warn(`[agent-loop-runner] batch insert error: ${insertErr.message} | rows: ${rowSummary}`)
    } else {
      written = rowsToInsert.length
    }
  }

  return { recruiter_id: recruiterId, pipelines_found: activePipelines.length, actions_generated: allActions.length, actions_written: written }
}
