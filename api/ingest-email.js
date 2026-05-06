/*
 * api/ingest-email.js — Inbound email ingestion webhook
 *
 * Receives webhook POSTs from an email forwarding service (CloudMailin, Resend Inbound,
 * SendGrid Inbound Parse). Normalizes the payload, runs the classifier first, then
 * branches: noise is discarded before any DB writes; client_communication writes an
 * interaction only; candidate_communication does the full match-or-create path.
 *
 * ── FLOW ──────────────────────────────────────────────────────────────────────
 * 1. Auth
 * 2. Parse payload
 * 3. Recruiter lookup (by email_intake_address → env fallback)
 * 4. Pre-classifier guards (self-send, domain blocklist, List-Unsubscribe header)
 * 5. Classify (Haiku)
 * 6. Branch:
 *    noise              → log to ingestion_log, return 200, no DB writes
 *    client_communication → write interaction (no candidate), fire loop
 *    candidate_communication → match or create candidate, write interaction, fire loop
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
 * CloudMailin sends { envelope: { from, to }, headers: { from, subject, date, ... },
 *   plain, html }. Headers are all lowercase in the normalized JSON format.
 *   The normalizePayload() function handles this automatically.
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
  // CloudMailin JSON Normalized format — headers are all lowercase
  if (body.envelope || body.headers) {
    return {
      fromRaw:         body.headers?.from     || body.envelope?.from || body.from || '',
      to:              body.envelope?.to       || body.headers?.to   || body.to   || '',
      subject:         body.headers?.subject  || body.subject        || '',
      text:            body.plain || stripHtml(body.html || '') || body.text || '',
      dateStr:         body.headers?.date     || body.date           || null,
      listUnsubscribe: body.headers?.['list-unsubscribe'] || null,
    }
  }
  // Flat format (testing + other services)
  return {
    fromRaw:         body.from    || '',
    to:              body.to      || '',
    subject:         body.subject || '',
    text:            body.text    || body.plain || stripHtml(body.html || ''),
    dateStr:         body.date    || null,
    listUnsubscribe: null,
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

// ── Pre-classifier noise guards ───────────────────────────────────────────────

const NOISE_ADDRESSES = new Set([
  'noreply@linkedin.com',
  'notifications@linkedin.com',
  'no-reply@accounts.google.com',
])
const NOISE_PREFIXES    = ['mailer-daemon@', 'bounce@']
const NOISE_SUBSTRINGS  = ['unsubscribe@']

function isBlocklistedAddress(email) {
  const e = (email || '').toLowerCase()
  if (NOISE_ADDRESSES.has(e))                      return true
  if (NOISE_PREFIXES.some(p => e.startsWith(p)))   return true
  if (NOISE_SUBSTRINGS.some(s => e.includes(s)))   return true
  return false
}

// ── ingestion_log writer (fire-and-forget — never blocks response) ────────────

async function writeIngestionLog(recruiterId, fromEmail, subject, classification, reason, rawBody) {
  try {
    await supabase.from('ingestion_log').insert({
      recruiter_id:   recruiterId,
      from_email:     fromEmail || null,
      subject:        (subject || '').slice(0, 300) || null,
      classification,
      reason,
      raw_payload: {
        from:         rawBody.from  || rawBody.envelope?.from  || rawBody.headers?.from  || null,
        to:           rawBody.to    || rawBody.envelope?.to    || rawBody.headers?.to    || null,
        subject:      (rawBody.subject || rawBody.headers?.subject || '').slice(0, 300),
        body_preview: (rawBody.plain  || rawBody.text || '').slice(0, 300),
      },
    })
  } catch (err) {
    console.warn('[ingest-email] ingestion_log write failed:', err.message)
  }
}

// ── Agent loop trigger (fire-and-forget) ──────────────────────────────────────

function triggerLoop(host, recruiterId) {
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  fetch(`${protocol}://${host}/api/agent-loop?recruiter_id=${recruiterId}`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${process.env.AGENT_LOOP_SECRET}` },
  }).catch(err => console.warn('[ingest-email] loop trigger error:', err.message))
}

// ── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Auth: Bearer header or ?secret= query param
  const secret      = process.env.EMAIL_INGEST_SECRET
  const authHeader  = req.headers['authorization']
  const querySecret = req.query?.secret
  const authenticated =
    (authHeader  && authHeader  === `Bearer ${secret}`) ||
    (querySecret && querySecret === secret)

  if (!authenticated) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const { fromRaw, to, subject, text, dateStr, listUnsubscribe } = normalizePayload(req.body)
    const from       = parseFrom(fromRaw)
    const body       = text.trim()
    const occurredAt = parseDate(dateStr)

    if (!from.email) {
      return res.status(400).json({ error: 'Missing sender email' })
    }

    // ── Recruiter lookup ─────────────────────────────────────────────────────
    // Fetch email alongside id so we can do the self-send guard below.
    let recruiter = null

    if (to) {
      const { data } = await supabase
        .from('recruiters')
        .select('id, email')
        .ilike('email_intake_address', to.toLowerCase())
        .maybeSingle()
      if (data) recruiter = data
    }

    if (!recruiter && process.env.WREN_RECRUITER_ID) {
      const { data } = await supabase
        .from('recruiters')
        .select('id, email')
        .eq('id', process.env.WREN_RECRUITER_ID)
        .maybeSingle()
      if (data) recruiter = data
    }

    if (!recruiter) {
      console.warn('[ingest-email] no recruiter matched for to:', to)
      return res.status(200).json({ ok: true, skipped: 'no_recruiter_match' })
    }

    const recruiterId = recruiter.id

    // ── Guard 1: self-send ───────────────────────────────────────────────────
    // Protects against forwarding loops and the recruiter emailing themselves.
    if (recruiter.email && from.email === recruiter.email.toLowerCase()) {
      return res.status(200).json({ ok: true, skipped: 'self_send' })
    }

    // ── Guard 2: domain blocklist ────────────────────────────────────────────
    // Hard-coded noise sources — skip classifier API call entirely.
    if (isBlocklistedAddress(from.email)) {
      writeIngestionLog(recruiterId, from.email, subject, 'noise', 'blocklist', req.body)
      return res.status(200).json({ ok: true, skipped: 'blocklist' })
    }

    // ── Guard 3: List-Unsubscribe header ─────────────────────────────────────
    // Newsletters and marketing emails almost always include this header.
    if (listUnsubscribe) {
      writeIngestionLog(recruiterId, from.email, subject, 'noise', 'unsubscribe_header', req.body)
      return res.status(200).json({ ok: true, skipped: 'unsubscribe_header' })
    }

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

    // ── Branch: noise (or classifier failure) ────────────────────────────────
    if (kind === 'noise' || kind === null) {
      writeIngestionLog(recruiterId, from.email, subject,
        kind || 'unknown',
        kind === 'noise' ? 'classified_noise' : 'classifier_failed',
        req.body)
      return res.status(200).json({ ok: true, skipped: kind || 'unknown', classification })
    }

    // ── Branch: client_communication ─────────────────────────────────────────
    // Write interaction without a candidate (candidate_id is now nullable).
    // No candidate match or creation. Loop fires to update any related pipelines.
    if (kind === 'client_communication') {
      const { data: interaction, error: intErr } = await supabase
        .from('interactions')
        .insert({
          recruiter_id: recruiterId,
          candidate_id: null,
          pipeline_id:  null,
          type:         'email',
          direction:    'inbound',
          subject:      subject || null,
          body:         body   || null,
          occurred_at:  occurredAt,
          meta: {
            from_name:      from.name  || null,
            from_email:     from.email || null,
            classification: classification ?? null,
          },
        })
        .select('id')
        .single()

      if (intErr) throw intErr

      triggerLoop(req.headers.host || 'localhost:3000', recruiterId)

      return res.status(200).json({
        ok:             true,
        interaction_id: interaction.id,
        classification: classification ?? null,
        loop_triggered: true,
      })
    }

    // ── Branch: candidate_communication — full path ──────────────────────────
    let candidateId      = null
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
          recruiter_id: recruiterId,
          first_name,
          last_name,
          email:        from.email || null,
          source:       'inbound',
        })
        .select('id')
        .single()

      if (createErr) throw createErr
      candidateId      = newCandidate.id
      candidateCreated = true
    }

    // ── Active pipeline lookup ───────────────────────────────────────────────
    // Build 1 heuristic: link to the most recently-updated active pipeline.
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

    // ── Trigger agent loop (fire-and-forget) ─────────────────────────────────
    triggerLoop(req.headers.host || 'localhost:3000', recruiterId)

    return res.status(200).json({
      ok:                true,
      interaction_id:    interaction.id,
      candidate_id:      candidateId,
      candidate_created: candidateCreated,
      pipeline_id:       pipelineId,
      classification:    classification ?? null,
      loop_triggered:    true,
    })

  } catch (err) {
    console.error('[ingest-email] error:', err)
    return res.status(500).json({ error: err.message })
  }
}
