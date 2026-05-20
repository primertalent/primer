/*
 * api/_lib/runBackgroundDebrief.js — Shared debrief extraction logic
 *
 * Called by two paths:
 *   CandidateCard.jsx (UI path)     — after manual interaction log save
 *   ingest-email.js  (ingest path)  — after Gemini Notes interaction write
 *
 * ── generateFn contract ───────────────────────────────────────────────────────
 * async (messages: { role: string, content: string }[], opts: { maxTokens: number }) => string
 *
 * Must return the raw model text response. JSON parsing is done here.
 * Callers provide the transport that fits their context:
 *
 *   CandidateCard.jsx:
 *     (messages, opts) => generateText({ messages, ...opts })
 *     (POSTs to /api/ai — keeps the API key server-side)
 *
 *   ingest-email.js:
 *     async (messages, { maxTokens }) => {
 *       const resp = await anthropic.messages.create({
 *         model: 'claude-sonnet-4-6', max_tokens: maxTokens, messages,
 *       })
 *       return resp.content.find(b => b.type === 'text')?.text ?? ''
 *     }
 *
 * ── Context loading ───────────────────────────────────────────────────────────
 * Always fetches candidate, pipeline, and prior debriefs from DB.
 * Accepts supabase as a parameter — browser client (RLS) or service-role (no RLS).
 * The interface is clean: callers pass IDs, not pre-loaded objects.
 *
 * ── Return value ──────────────────────────────────────────────────────────────
 * { debrief, completedActionIds } on success, null on guard/failure.
 * completedActionIds: UUIDs of risk_flag / sharpening_ask rows just completed.
 * Browser callers (CandidateCard) should pass these to onActionsCompleted so
 * the Desk removes those cards immediately. Server callers can ignore them.
 */

import { buildDebriefExtractorMessages } from '../../src/lib/prompts/debriefExtractor.js'

export async function runBackgroundDebrief({
  supabase,
  generateFn,
  recruiterId,
  candidateId,
  pipelineId,     // uuid | null — pipeline context optional; skips next_action + action auto-complete when null
  interactionId,  // uuid | null — stored as FK on the debrief row
  notesBody,
}) {
  if (!notesBody?.trim()) return null

  // ── Fetch all context from DB in parallel ─────────────────────────────────
  const [candRes, pipelineRes, debriefRes] = await Promise.all([
    supabase
      .from('candidates')
      .select('id, first_name, last_name, current_title, current_company')
      .eq('id', candidateId)
      .single(),

    pipelineId
      ? supabase
          .from('pipeline')
          .select('id, current_stage, role_id, roles(id, title, clients(name))')
          .eq('id', pipelineId)
          .single()
      : Promise.resolve({ data: null }),

    supabase
      .from('debriefs')
      .select('captured_at, outcome, summary')
      .eq('candidate_id', candidateId)
      .order('captured_at', { ascending: false })
      .limit(3),
  ])

  const candidate     = candRes.data
  const pipeline      = pipelineRes.data ?? null
  const priorDebriefs = debriefRes.data  ?? []

  if (!candidate) return null

  const role  = pipeline?.roles         ?? null
  const stage = pipeline?.current_stage ?? null

  // ── Extract structured signal ─────────────────────────────────────────────
  let extracted
  try {
    const messages = buildDebriefExtractorMessages(candidate, role, stage, priorDebriefs, notesBody)
    const raw      = await generateFn(messages, { maxTokens: 2048 })
    const cleaned  = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
    extracted      = JSON.parse(cleaned)
  } catch (err) {
    console.warn('[runBackgroundDebrief] extraction failed:', err.message)
    return null
  }

  // ── Write debrief row — same payload shape as the UI path ─────────────────
  const payload = {
    recruiter_id:           recruiterId,
    candidate_id:           candidateId,
    pipeline_id:            pipelineId        ?? null,
    role_id:                pipeline?.role_id ?? null,
    interaction_id:         interactionId     ?? null,
    outcome:                'neutral',
    feedback_raw:           notesBody,
    summary:                extracted.summary               ?? '',
    motivation_signals:     extracted.motivation_signals    ?? [],
    competitive_signals:    extracted.competitive_signals   ?? [],
    risk_flags:             extracted.risk_flags            ?? [],
    positive_signals:       extracted.positive_signals      ?? [],
    hiring_manager_signals: extracted.hiring_manager_signals ?? [],
    objections:             extracted.risk_flags            ?? [],
    strengths:              extracted.positive_signals      ?? [],
    next_action:            extracted.next_action           ?? '',
    questions_to_ask_next:  extracted.questions_to_ask_next ?? [],
    updates_to_record:      extracted.updates_to_record     ?? [],
  }

  const { data: debrief, error: saveErr } = await supabase
    .from('debriefs').insert(payload).select().single()
  if (saveErr) {
    console.warn('[runBackgroundDebrief] save failed:', saveErr.message)
    return null
  }

  // ── Update pipeline.next_action when pipeline context is available ─────────
  if (pipelineId && debrief.next_action) {
    try {
      await supabase
        .from('pipeline')
        .update({ next_action: debrief.next_action })
        .eq('id', pipelineId)
    } catch (err) {
      console.warn('[runBackgroundDebrief] next_action update failed:', err.message)
    }
  }

  // ── Auto-complete risk_flag and sharpening_ask cards for this pipeline ─────
  let completedActionIds = []
  if (pipelineId) {
    try {
      const { data: rows } = await supabase
        .from('actions').select('id')
        .eq('recruiter_id', recruiterId)
        .eq('linked_entity_id', pipelineId)
        .eq('linked_entity_type', 'pipeline')
        .in('action_type', ['risk_flag', 'sharpening_ask'])
        .is('acted_on_at', null)
        .is('dismissed_at', null)
      completedActionIds = (rows ?? []).map(r => r.id)
      if (completedActionIds.length) {
        await supabase
          .from('actions')
          .update({ acted_on_at: new Date().toISOString() })
          .in('id', completedActionIds)
      }
    } catch (err) {
      console.warn('[runBackgroundDebrief] action auto-complete failed:', err.message)
    }
  }

  return { debrief, completedActionIds }
}
