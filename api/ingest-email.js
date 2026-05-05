/*
 * api/ingest-email.js — Inbound email ingestion webhook
 *
 * Receives webhook POSTs from an email forwarding service (CloudMailin, Resend Inbound,
 * SendGrid Inbound Parse). Normalizes the payload, matches the sending candidate,
 * writes an interaction, classifies the email, and triggers an out-of-band agent loop run.
 *
 * ── EXPECTED PAYLOAD (generic normalized shape) ───────────────────────────────
 * {
 *   "from":    "Jane Smith <jane@example.com>",   // or just "jane@example.com"
 *   "to":      "wren@hirewren.com",               // the recruiter's intake address
 *   "subject": "Re: Software Engineer at Anthropic",
 *   "text":    "Hi, I can do a call next Tuesday...",
 *   "html":    "<p>Hi, I can do a call...</p>",   // optional, used if text is empty
 *   "date":    "2026-05-06T10:00:00Z"             // optional, falls back to now()
 * }
 *
 * ── CLOUDMAILIN MAPPING ───────────────────────────────────────────────────────
 * CloudMailin sends { envelope: { from, to }, headers: { From, Subject, Date },
 *   plain, html }. The normalizePayload() function handles this automatically.
 *
 * ── AUTHENTICATION ────────────────────────────────────────────────────────────
 * Validate via either:
 *   - Authorization: Bearer <EMAIL_INGEST_SECRET>   (header)
 *   - ?secret=<EMAIL_INGEST_SECRET>                 (query param — CloudMailin style)
 *
 * ── LOCAL CURL TEST ───────────────────────────────────────────────────────────
 * curl -X POST http://localhost:3000/api/ingest-email \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_EMAIL_INGEST_SECRET" \
 *   -d '{
 *     "from": "Jane Smith <jane@example.com>",
 *     "to": "wren@hirewren.com",
 *     "subject": "Re: Software Engineer role at Anthropic",
 *     "text": "Hi, I am interested in the role. Can we schedule a call next week?",
 *     "date": "2026-05-06T10:00:00Z"
 *   }'
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { buildInboundEmailClassifierMessages } from '../src/lib/prompts/inboundEmailClassifier.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const config = {
  maxDuration: 60,
}

// ── Payload helpers ───────────────────────────────────────────────────────────

function parseFrom(raw) {
  const match = /^(.*?)\s*<([^>]+)>/.exec((raw || '').trim())
  if (match) return { name: match[1].trim(), email: match[2].trim().toLowerCase() }
  return { name: '', email: (raw || '').trim().toLowerCase() }
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function normalizePayload(body) {
  // CloudMailin envelope/headers format
  if (body.envelope || body.headers) {
    return {
      fromRaw:  body.headers?.From  || body.envelope?.from || '',
      to:       body.envelope?.to   || body.headers?.To    || '',
      subject:  body.headers?.Subject || '',
      text:     body.plain || stripHtml(body.html || ''),
      dateStr:  body.headers?.Date  || null,
    }
  }
  // Flat format (testing + other services)
  return {
    fromRaw: body.from    || '',
    to:      body.to      || '',
    subject: body.subject || '',
    text:    body.text    || body.plain || stripHtml(body.html || ''),
    dateStr: body.date    || null,
  }
}

function parseDate(dateStr) {
  if (!dateStr) return new Date().toISOString()
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

function parseNameParts(fullName) {
  const parts = (fullName || '').trim().split(/\s+/)
  return {
    first_name: parts[0] || 'Unknown',
    last_name:  parts.slice(1).join(' ') || '—',
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Auth: Bearer header or ?secret= query param
  const secret = process.env.EMAIL_INGEST_SECRET
  const authHeader = req.headers['authorization']
  const querySecret = req.query?.secret
  const authenticated =
    (authHeader && authHeader === `Bearer ${secret}`) ||
    (querySecret && querySecret === secret)

  if (!authenticated) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const { fromRaw, to, subject, text, dateStr } = normalizePayload(req.body)
    const from       = parseFrom(fromRaw)
    const body       = text.trim()
    const occurredAt = parseDate(dateStr)

    if (!from.email) {
      return res.status(400).json({ error: 'Missing sender email' })
    }

    // ── Recruiter lookup ─────────────────────────────────────────────────────
    // Multi-tenant: match by email_intake_address column.
    // TODO: for Build 1, fall back to WREN_RECRUITER_ID env var if no address match found.
    let recruiterId = null

    if (to) {
      const { data: recruiterRow } = await supabase
        .from('recruiters')
        .select('id')
        .ilike('email_intake_address', to.toLowerCase())
        .maybeSingle()
      recruiterId = recruiterRow?.id ?? null
    }

    if (!recruiterId) {
      // Build 1 hardcode fallback — remove once email_intake_address is set in DB
      recruiterId = process.env.WREN_RECRUITER_ID ?? null
    }

    if (!recruiterId) {
      console.warn('[ingest-email] no recruiter matched for to:', to)
      return res.status(200).json({ ok: true, skipped: 'no_recruiter_match' })
    }

    // ── Candidate matching ───────────────────────────────────────────────────
    let candidateId = null
    let candidateCreated = false

    // 1. Exact email match
    if (from.email) {
      const { data: emailMatch } = await supabase
        .from('candidates')
        .select('id')
        .eq('recruiter_id', recruiterId)
        .ilike('email', from.email)
        .maybeSingle()
      candidateId = emailMatch?.id ?? null
    }

    // 2. Fuzzy name match (normalized case-insensitive first+last)
    if (!candidateId && from.name) {
      const { first_name, last_name } = parseNameParts(from.name)
      if (first_name && last_name && last_name !== '—') {
        const { data: nameMatch } = await supabase
          .from('candidates')
          .select('id')
          .eq('recruiter_id', recruiterId)
          .ilike('first_name', first_name)
          .ilike('last_name', last_name)
          .maybeSingle()
        candidateId = nameMatch?.id ?? null
      }
    }

    // 3. Create stub if no match
    if (!candidateId) {
      const { first_name, last_name } = from.name
        ? parseNameParts(from.name)
        : { first_name: (from.email.split('@')[0] || 'Unknown'), last_name: '—' }
      const { data: newCandidate, error: createErr } = await supabase
        .from('candidates')
        .insert({
          recruiter_id:  recruiterId,
          first_name,
          last_name,
          email:         from.email || null,
          source:        'inbound',
        })
        .select('id')
        .single()

      if (createErr) throw createErr
      candidateId    = newCandidate.id
      candidateCreated = true
    }

    // ── Active pipeline lookup ───────────────────────────────────────────────
    // Build 1 heuristic: link to the most recently-updated active pipeline.
    // Revisit in Build 2 when subject-line role matching gives us better signal.
    const { data: activePipelines } = await supabase
      .from('pipeline')
      .select('id, updated_at')
      .eq('candidate_id', candidateId)
      .eq('recruiter_id', recruiterId)
      .eq('status', 'active')
      .not('current_stage', 'in', '(placed,lost)')
      .order('updated_at', { ascending: false })
      .limit(1)

    const pipelineId = activePipelines?.[0]?.id ?? null

    // ── Classify email (Haiku — fast, cheap) ────────────────────────────────
    let classification = null
    try {
      const { system, messages, maxTokens } = buildInboundEmailClassifierMessages({
        from: { name: from.name, email: from.email },
        subject,
        body,
      })
      const aiResp = await anthropic.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        system,
        messages,
      })
      const raw = aiResp.content.find(b => b.type === 'text')?.text ?? ''
      try { classification = JSON.parse(raw.trim()) } catch {
        const match = raw.match(/\{[\s\S]*\}/)
        if (match) try { classification = JSON.parse(match[0]) } catch {}
      }
    } catch (classifyErr) {
      console.warn('[ingest-email] classifier error:', classifyErr.message)
    }

    const kind = classification?.kind ?? null

    // ── Write interaction ────────────────────────────────────────────────────
    const { data: interaction, error: intErr } = await supabase
      .from('interactions')
      .insert({
        recruiter_id: recruiterId,
        candidate_id: candidateId,
        pipeline_id:  pipelineId,
        type:         'email',
        direction:    'inbound',
        subject:      subject || null,
        body:         body   || null,
        occurred_at:  occurredAt,
        meta: {
          from_name:         from.name  || null,
          from_email:        from.email || null,
          classification:    classification ?? null,
          candidate_created: candidateCreated,
        },
      })
      .select('id')
      .single()

    if (intErr) throw intErr

    // ── Trigger agent loop (fire-and-forget, skip if noise) ─────────────────
    // POST to /api/agent-loop as a separate function invocation — it gets its own
    // 60s timeout and is not affected by this function's response being sent.
    // We do not await the fetch; early termination of this invocation is harmless.
    const loopTriggered = kind !== 'noise'
    if (loopTriggered) {
      const host     = req.headers.host || 'localhost:3000'
      const protocol = host.startsWith('localhost') ? 'http' : 'https'
      fetch(`${protocol}://${host}/api/agent-loop?recruiter_id=${recruiterId}`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${process.env.AGENT_LOOP_SECRET}` },
      }).catch(err => console.warn('[ingest-email] loop trigger error:', err.message))
    }

    return res.status(200).json({
      ok:                true,
      interaction_id:    interaction.id,
      candidate_id:      candidateId,
      candidate_created: candidateCreated,
      pipeline_id:       pipelineId,
      classification:    classification ?? null,
      loop_triggered:    loopTriggered,
    })

  } catch (err) {
    console.error('[ingest-email] error:', err)
    return res.status(500).json({ error: err.message })
  }
}
