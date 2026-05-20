/*
 * api/extract-comp.js — Extract expected comp for a recruiter-confirmed proposed match
 *
 * P4-2 (extractCompFromNotes) fires in ingest-email.js only for auto-matches at ≥90%
 * confidence. Recruiter-confirmed proposed matches create a pipeline via confirm_role_match
 * in Desk.jsx, but extractCompFromNotes is never called for them. This endpoint closes
 * that gap: Desk fires it fire-and-forget after confirm_role_match succeeds.
 *
 * POST body: { pipeline_id, notes_body, action_id? }
 * Auth:      Supabase JWT in Authorization: Bearer header
 *
 * Never overwrites existing expected_comp.
 * Merges calibration fields (auto_comp_*) into action context for monitoring.
 * Returns { ok: true } or { ok: true, skipped: string } on any non-error path.
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { extractCompFromNotes } from './_lib/extractCompFromNotes.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const jwt = req.headers.authorization?.replace('Bearer ', '').trim()
  if (!jwt) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt)
  if (userErr || !user) return res.status(401).json({ error: 'unauthorized' })

  const { data: recruiter } = await supabase
    .from('recruiters').select('id').eq('user_id', user.id).single()
  if (!recruiter) return res.status(404).json({ error: 'recruiter_not_found' })

  const { pipeline_id, notes_body, action_id } = req.body
  if (!pipeline_id || !notes_body) return res.status(400).json({ error: 'missing_fields' })

  // Never overwrite existing comp
  const { data: pipeline } = await supabase
    .from('pipeline')
    .select('expected_comp')
    .eq('id', pipeline_id)
    .eq('recruiter_id', recruiter.id)
    .single()

  if (!pipeline) return res.status(404).json({ error: 'pipeline_not_found' })
  if (pipeline.expected_comp) return res.json({ ok: true, skipped: 'comp_already_set' })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // motivationSummary not available in action context for proposed matches —
  // pass null and rely on notesBody regex + Haiku fallback (same as Outcome C in ingest-email.js)
  const compResult = await extractCompFromNotes({
    anthropic,
    notesBody:          notes_body,
    motivationSummary:  null,
  })

  if (compResult) {
    try {
      await supabase
        .from('pipeline')
        .update({ expected_comp: compResult.low, expected_comp_high: compResult.high ?? null })
        .eq('id', pipeline_id)
    } catch (err) {
      console.warn('[extract-comp] pipeline write failed:', err.message)
    }
  }

  // Merge calibration fields into action context so the same monitoring
  // signals present on auto-match cards are visible here too.
  if (action_id) {
    try {
      const { data: actionRow } = await supabase
        .from('actions').select('context').eq('id', action_id).single()
      const mergedContext = {
        ...(actionRow?.context ?? {}),
        auto_comp_extracted:      !!compResult,
        auto_comp_confidence:     compResult?.confidence      ?? null,
        auto_comp_value_low:      compResult?.low             ?? null,
        auto_comp_value_high:     compResult?.high            ?? null,
        auto_comp_source_excerpt: compResult?.source_excerpt  ?? null,
        auto_comp_pass:           compResult?.pass            ?? 'none',
      }
      await supabase.from('actions').update({ context: mergedContext }).eq('id', action_id)
    } catch (err) {
      console.warn('[extract-comp] action context merge failed:', err.message)
    }
  }

  return res.json({ ok: true, compResult: compResult ?? null })
}
