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
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { buildInboundEmailClassifierMessages } from '../src/lib/prompts/inboundEmailClassifier.js'
import { matchRoleFromNotes } from './_lib/matchRoleFromNotes.js'
import { extractCompFromNotes } from './_lib/extractCompFromNotes.js'

// ── Gemini Notes detection helpers ───────────────────────────────────────────

function isGeminiNotesEmail(fromEmail, subject, body) {
  // Primary: deterministic sender address (direct delivery from Google).
  if ((fromEmail || '').toLowerCase() === 'gemini-notes@google.com') return true
  // Secondary: subject + body signals — handles forwarded versions where the
  // recruiter forwards the email to the CloudMailin address manually.
  // Subject patterns: "Notes: ...", "Fw: Notes: ...", "Fwd: Notes: ..."
  const s = (subject || '').trim()
  const subjectMatch = /^(?:Fwd?:\s*)?Notes:/i.test(s)
  // Body signals: auto-generated text, invited-guests notice, or the original
  // sender address appearing in the quoted body of a forwarded email.
  const bodyMatch = /auto-generated|These notes have been sent to invited guests|gemini-notes@google\.com/i.test(body || '')
  return subjectMatch && bodyMatch
}

// Extracts the candidate's name from a Gemini Notes subject line.
// Expected pattern: "Notes: ... between [Recruiter Name] and [Candidate Name] [date?]"
// The second person after "and" is the candidate.
// Strips Fw:/Fwd:/Re: prefixes before matching so forwarded subjects work correctly.
function extractCandidateNameRegex(subject) {
  const normalized = (subject || '').replace(/^(Fwd?:|Re:)\s*/gi, '').trim()
  const m = /between\s+(?:[A-Z]\S+(?:\s+[A-Z]\S+)*)\s+and\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i.exec(normalized)
  if (!m) return null
  // Strip trailing date tokens (e.g. "May 6, 2026" or "5/6/2026")
  return m[1].replace(/\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d).*$/i, '').trim() || null
}

async function extractCandidateNameFromSubject(subject) {
  const fromRegex = extractCandidateNameRegex(subject)
  if (fromRegex) return fromRegex

  // Haiku fallback for non-standard subject formats (quoted titles, missing "between", etc.)
  // Strip forward/reply prefixes before passing to the model — cleaner signal.
  const normalizedSubject = (subject || '').replace(/^(Fwd?:|Re:)\s*/gi, '').trim()
  try {
    const resp = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 30,
      messages:   [{
        role:    'user',
        content: `This is a Google Gemini meeting notes email subject. Extract only the job candidate's full name. The subject describes a call between a recruiter and a job candidate. Return only the candidate's full name. If uncertain, return "unknown".\n\nSubject: ${normalizedSubject}`,
      }],
    })
    const name = resp.content.find(b => b.type === 'text')?.text?.trim() ?? ''
    return (name === 'unknown' || !name) ? null : name
  } catch {
    return null
  }
}

// Extracts structured candidate fields from Gemini Notes body via Haiku.
// Bounded at 250 tokens; falls back to all-null on any parse failure so
// candidate creation always proceeds even if extraction returns garbage.
async function extractCandidateFieldsFromNotes(notesBody) {
  try {
    const resp = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 250,
      messages:   [{
        role:    'user',
        content: `Extract candidate data from these recruiter call notes. Return ONLY valid JSON with these exact fields (null for anything not mentioned):
{"current_title":null,"current_company":null,"location":null,"motivation_summary":null,"source_context":null}

Call notes:
${(notesBody || '').slice(0, 3000)}`,
      }],
    })
    const raw     = resp.content.find(b => b.type === 'text')?.text?.trim() ?? ''
    const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
    const parsed  = JSON.parse(cleaned)
    return {
      current_title:      typeof parsed.current_title      === 'string' ? parsed.current_title.slice(0, 200)      : null,
      current_company:    typeof parsed.current_company    === 'string' ? parsed.current_company.slice(0, 200)    : null,
      location:           typeof parsed.location           === 'string' ? parsed.location.slice(0, 200)           : null,
      motivation_summary: typeof parsed.motivation_summary === 'string' ? parsed.motivation_summary.slice(0, 500) : null,
      source_context:     typeof parsed.source_context     === 'string' ? parsed.source_context.slice(0, 300)     : null,
    }
  } catch {
    return { current_title: null, current_company: null, location: null, motivation_summary: null, source_context: null }
  }
}

// ── Gemini Notes ingestion path ───────────────────────────────────────────────
// Capture only — no AI draft generation. Draft fires when the recruiter
// explicitly clicks "Draft submittal" on the action card (Piece 3 Chunk 2).
//
// Candidate resolution (per "Wren enhances the life the recruiter already lives"):
//   Wren auto-creates the candidate record when name extraction succeeds.
//   notes_pending_match only fires when name extraction itself fails entirely.
//
// Outcomes after candidate resolution:
//   A — name extraction failed (both regex + Haiku) → notes_pending_match (safety net)
//   B — candidate resolved, no active pipeline → intake_notes_ready (no pipeline context)
//   C — candidate resolved + active pipeline → intake_notes_ready (full pipeline context)

async function handleGeminiNotesPath({ recruiterId, subject, body, from, occurredAt, messageId, host }) {
  const candidateName = await extractCandidateNameFromSubject(subject)

  // ── Outcome A (safety net): name extraction completely failed ────────────
  // Both regex and Haiku returned null — no structured signal to work with.
  // Write interaction with null candidate_id and surface notes_pending_match.
  // This branch is rare; the common path continues below.
  if (!candidateName) {
    const { data: interaction, error: intErr } = await supabase
      .from('interactions')
      .insert({
        recruiter_id: recruiterId,
        candidate_id: null,
        pipeline_id:  null,
        type:         'email',
        direction:    'inbound',
        subject:      subject    || null,
        body:         body       || null,
        occurred_at:  occurredAt,
        message_id:   messageId || null,
        meta: { from_email: from.email || null, is_meet_notes: true, candidate_name_extracted: null, classification: 'candidate_communication' },
      })
      .select('id')
      .single()

    if (intErr) throw intErr

    try {
      await supabase.from('actions').insert({
        recruiter_id:        recruiterId,
        action_type:         'notes_pending_match',
        linked_entity_id:    null,
        linked_entity_type:  null,
        urgency:             'today',
        why:                 subject
          ? `Meet notes received — "${subject.slice(0, 80)}" — but I couldn't identify the candidate. Tell me who this is.`
          : `Meet notes received but I couldn't identify the candidate from the subject. Tell me who this is.`,
        suggested_next_step: 'Match candidate',
        confidence:          'high',
        content_hash:        crypto.createHash('sha256').update(`${recruiterId}:null:notes_pending_match:${interaction.id}`).digest('hex'),
        context: { interaction_id: interaction.id, subject: subject || null, extracted_name: null },
      })
    } catch (err) {
      console.warn('[ingest-email] notes_pending_match action insert failed:', err.message)
    }

    triggerLoop(host, recruiterId)
    return { outcome: 'A', candidate_name: null }
  }

  // ── Candidate resolution: lookup existing or auto-create ─────────────────
  // Wren has the candidate's name from the subject. Look up first — handles
  // retries and cases where the recruiter manually added the candidate.
  // If not found, auto-create from structured Gemini Notes body so the recruiter
  // never has to type data Wren already has (per "Wren enhances the life the
  // recruiter already lives" principle).
  const { first_name, last_name } = parseNameParts(candidateName)
  let candidateId     = null
  let candidateRecord = null
  let candidateCreated = false
  let motivationSummary = null

  let q = supabase
    .from('candidates')
    .select('id, first_name, last_name, current_title, current_company, location')
    .eq('recruiter_id', recruiterId)
    .ilike('first_name', first_name)

  if (last_name && last_name !== '—') q = q.ilike('last_name', last_name)

  const { data: existing } = await q.maybeSingle()

  if (existing) {
    candidateId     = existing.id
    candidateRecord = existing
  } else {
    // Not found — extract fields from notes body and create the record
    const extracted = await extractCandidateFieldsFromNotes(body)
    motivationSummary = extracted.motivation_summary ?? null
    const enrichment = (extracted.motivation_summary || extracted.source_context)
      ? { intake_motivation: extracted.motivation_summary || null, source_context: extracted.source_context || null }
      : null

    const { data: newCand, error: createErr } = await supabase
      .from('candidates')
      .insert({
        recruiter_id:    recruiterId,
        first_name,
        last_name:       last_name !== '—' ? last_name : null,
        source:          'inbound',
        current_title:   extracted.current_title   || null,
        current_company: extracted.current_company || null,
        location:        extracted.location        || null,
        ...(enrichment ? { enrichment_data: enrichment } : {}),
      })
      .select('id, first_name, last_name, current_title, current_company, location')
      .single()

    if (createErr) throw createErr
    candidateId      = newCand.id
    candidateRecord  = newCand
    candidateCreated = true
  }

  // ── Write interaction (candidate_id always set at this point) ────────────
  const { data: interaction, error: intErr } = await supabase
    .from('interactions')
    .insert({
      recruiter_id: recruiterId,
      candidate_id: candidateId,
      pipeline_id:  null,
      type:         'email',
      direction:    'inbound',
      subject:      subject    || null,
      body:         body       || null,
      occurred_at:  occurredAt,
      message_id:   messageId || null,
      meta: {
        from_email:               from.email    || null,
        is_meet_notes:            true,
        candidate_name_extracted: candidateName,
        candidate_created:        candidateCreated,
        classification:           'candidate_communication',
      },
    })
    .select('id')
    .single()

  if (intErr) throw intErr

  // ── Active pipeline lookup (with role + client context for Outcome C) ────
  const { data: activePipelines } = await supabase
    .from('pipeline')
    .select('id, expected_comp, roles(id, title, notes, target_comp_min, target_comp_max, clients(id, name))')
    .eq('candidate_id', candidateId)
    .eq('recruiter_id', recruiterId)
    .eq('status', 'active')
    .not('current_stage', 'in', '(placed,lost)')
    .order('updated_at', { ascending: false })
    .limit(1)

  const candidateFullName = [candidateRecord.first_name, candidateRecord.last_name].filter(Boolean).join(' ')

  // ── Outcome B: candidate found, no active pipeline ───────────────────────
  // P4-1: attempt role match before writing the action card.
  // Match result determines three states: auto-create (≥90), propose (60-89), no match.
  if (!activePipelines?.length) {
    const matchResult = await matchRoleFromNotes({
      supabase,
      anthropic,
      recruiterId,
      notesBody:       body,
      candidateFields: {
        current_company: candidateRecord.current_company,
        current_title:   candidateRecord.current_title,
      },
    })

    let pipelineId    = null
    let autoMatched   = false
    let proposedMatch = null
    let matchType     = null
    let matchConf     = null

    if (matchResult) {
      const { role: matchedRole, confidence, matchType: mType } = matchResult
      matchType = mType
      matchConf = confidence

      if (confidence >= 90) {
        // Dedup: unique constraint on (candidate_id, role_id) — check before insert.
        const { data: existingPipeline } = await supabase
          .from('pipeline')
          .select('id')
          .eq('candidate_id', candidateId)
          .eq('role_id', matchedRole.id)
          .maybeSingle()

        if (!existingPipeline) {
          const firstStage = matchedRole.process_steps?.[0] ?? 'Sourced'
          const { data: newPipeline, error: pipelineErr } = await supabase
            .from('pipeline')
            .insert({
              recruiter_id:  recruiterId,
              candidate_id:  candidateId,
              role_id:       matchedRole.id,
              current_stage: firstStage,
              status:        'active',
            })
            .select('id')
            .single()

          if (!pipelineErr && newPipeline) {
            pipelineId  = newPipeline.id
            autoMatched = true
          }
        }
        // existingPipeline found: unique constraint would fire — skip auto-create,
        // fall through to no-match (add to role) behavior.
      } else {
        // 60-89: propose with one-click confirm
        proposedMatch = {
          role_id:     matchedRole.id,
          role_title:  matchedRole.title,
          client_name: matchedRole.clients?.name ?? null,
          confidence,
        }
      }

      // Link the interaction to the new pipeline if created
      if (pipelineId) {
        await supabase.from('interactions').update({ pipeline_id: pipelineId }).eq('id', interaction.id)
      }
    }

    // ── P4-2: Auto-extract expected comp from call notes ──────────────────────
    // Only fires when pipelineId exists (pipeline auto-created by P4-1 match).
    // Skips when no pipeline — no row to write to, no orphan signal.
    let compResult = null
    if (pipelineId) {
      compResult = await extractCompFromNotes({ anthropic, notesBody: body, motivationSummary })
      if (compResult) {
        try {
          await supabase
            .from('pipeline')
            .update({ expected_comp: compResult.low, expected_comp_high: compResult.high ?? null })
            .eq('id', pipelineId)
        } catch (err) {
          console.warn('[ingest-email] comp auto-write (B) failed:', err.message)
        }
      }
    }

    const matchedRole = matchResult?.role ?? null

    // Build action copy and linked entity based on match state
    let why, suggestedNextStep
    const linkedEntityId   = pipelineId ?? candidateId
    const linkedEntityType = pipelineId ? 'pipeline' : 'candidate'

    if (autoMatched && matchedRole) {
      why               = `Intake call notes for ${candidateFullName}, matched to ${matchedRole.title} at ${matchedRole.clients?.name ?? 'the client'} — pipeline created.`
      suggestedNextStep = 'Read notes or draft the submittal'
    } else if (proposedMatch) {
      why               = `Intake call notes for ${candidateFullName}. Looks like ${proposedMatch.role_title} at ${proposedMatch.client_name ?? 'the client'} — right role?`
      suggestedNextStep = 'Confirm to create the pipeline, or choose a different role'
    } else {
      why               = `Intake call notes captured for ${candidateFullName}. Add to a role to draft the submittal.`
      suggestedNextStep = 'Read notes or add to a role'
    }

    try {
      await supabase.from('actions').insert({
        recruiter_id:        recruiterId,
        action_type:         'intake_notes_ready',
        linked_entity_id:    linkedEntityId,
        linked_entity_type:  linkedEntityType,
        urgency:             'today',
        why,
        suggested_next_step: suggestedNextStep,
        confidence:          'high',
        content_hash:        crypto.createHash('sha256')
          .update(`${recruiterId}:${linkedEntityId}:intake_notes_ready:${interaction.id}`)
          .digest('hex'),
        context: {
          interaction_id: interaction.id,
          candidate_id:   candidateId,
          candidate_name: candidateFullName,
          pipeline_id:    pipelineId   ?? null,
          role_id:        matchedRole?.id    ?? null,
          role_title:     matchedRole?.title ?? null,
          client_name:    matchedRole?.clients?.name ?? null,
          notes_body:     body || '',
          // P4-1 match calibration — seed for V2 confidence calibration loop
          auto_matched:          autoMatched,
          auto_match_confidence: matchConf,
          auto_match_type:       matchType,
          proposed_match:        proposedMatch,
          matched_at:            matchResult ? new Date().toISOString() : null,
          // P4-2 comp calibration — always present, even when extraction returned null
          auto_comp_extracted:      !!compResult,
          auto_comp_confidence:     compResult?.confidence      ?? null,
          auto_comp_value_low:      compResult?.low             ?? null,
          auto_comp_value_high:     compResult?.high            ?? null,
          auto_comp_source_excerpt: compResult?.source_excerpt  ?? null,
          auto_comp_pass:           compResult?.pass            ?? 'none',
        },
      })
    } catch (err) {
      console.warn('[ingest-email] intake_notes_ready (B+match) action insert failed:', err.message)
    }

    triggerLoop(host, recruiterId)
    return {
      outcome:        'B',
      candidate_id:   candidateId,
      candidate_name: candidateFullName,
      auto_matched:   autoMatched,
      proposed_match: proposedMatch ?? null,
    }
  }

  // ── Outcome C: candidate found + active pipeline ─────────────────────────
  const pipeline    = activePipelines[0]
  const role        = pipeline.roles
  const client      = role?.clients
  const roleTitle   = role?.title ?? 'the role'

  // Link interaction to pipeline
  await supabase.from('interactions').update({ pipeline_id: pipeline.id }).eq('id', interaction.id)

  // ── P4-2: Auto-extract expected comp from call notes (Outcome C) ──────────
  // Only writes when pipeline.expected_comp IS NULL. Never overwrites.
  let compResult = null
  if (!pipeline.expected_comp) {
    compResult = await extractCompFromNotes({ anthropic, notesBody: body, motivationSummary: null })
    if (compResult) {
      try {
        await supabase
          .from('pipeline')
          .update({ expected_comp: compResult.low, expected_comp_high: compResult.high ?? null })
          .eq('id', pipeline.id)
      } catch (err) {
        console.warn('[ingest-email] comp auto-write (C) failed:', err.message)
      }
    }
  }

  try {
    await supabase.from('actions').insert({
      recruiter_id:        recruiterId,
      action_type:         'intake_notes_ready',
      linked_entity_id:    pipeline.id,
      linked_entity_type:  'pipeline',
      urgency:             'today',
      why:                 `Intake call notes captured for ${candidateFullName}, pitched for ${roleTitle}. Ready to draft submittal when you are.`,
      suggested_next_step: 'Read notes or trigger submittal draft',
      confidence:          'high',
      content_hash:        crypto.createHash('sha256')
        .update(`${recruiterId}:${pipeline.id}:intake_notes_ready:${interaction.id}`)
        .digest('hex'),
      context: {
        interaction_id: interaction.id,
        candidate_id:   candidateId,
        candidate_name: candidateFullName,
        pipeline_id:    pipeline.id,
        role_id:        role?.id       ?? null,
        role_title:     roleTitle,
        client_name:    client?.name   ?? null,
        notes_body:     body           || '',
        // P4-2 comp calibration — always present, even when extraction returned null
        auto_comp_extracted:      !!compResult,
        auto_comp_confidence:     compResult?.confidence      ?? null,
        auto_comp_value_low:      compResult?.low             ?? null,
        auto_comp_value_high:     compResult?.high            ?? null,
        auto_comp_source_excerpt: compResult?.source_excerpt  ?? null,
        auto_comp_pass:           compResult?.pass            ?? 'none',
      },
    })
  } catch (err) {
    console.warn('[ingest-email] intake_notes_ready (C) action insert failed:', err.message)
  }

  triggerLoop(host, recruiterId)
  return { outcome: 'C', candidate_id: candidateId, pipeline_id: pipeline.id }
}

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
      // Defensive: check all known CloudMailin variants for Message-ID header
      messageId:       body.headers?.['message-id'] || body.headers?.['message_id'] || body.headers?.['Message-ID'] || null,
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
    messageId:       null,
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

function buildWhy(name, intent) {
  const who  = name || 'A candidate'
  if (!intent) return `${who} replied.`
  const detail = intent.charAt(0).toUpperCase() + intent.slice(1)
  return `${who} replied. ${detail.endsWith('.') ? detail : `${detail}.`}`
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
    const { fromRaw, to, subject, text, dateStr, listUnsubscribe, messageId } = normalizePayload(req.body)
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

    // ── Message-ID dedup (webhook retry protection) ──────────────────────────
    // CloudMailin retries when it doesn't receive a 200 within its timeout.
    // If we've already processed this exact email, return 200 immediately.
    // Skipped when messageId is null (flat test format, manual triggers).
    if (messageId) {
      const { data: dupInteraction } = await supabase
        .from('interactions')
        .select('id')
        .eq('recruiter_id', recruiterId)
        .eq('message_id', messageId)
        .maybeSingle()
      if (dupInteraction) {
        return res.status(200).json({ ok: true, skipped: 'duplicate_message_id', interaction_id: dupInteraction.id })
      }
    }

    // ── Guard 1: Gemini Notes → capture path ────────────────────────────────
    // Must run before the self-send guard: when Ryan manually forwards a Gemini
    // Notes email to CloudMailin, the from address is ryan@primertalent.com.
    // The self-send guard would silently discard it. Gemini Notes detection
    // runs first so forwarded meet recap emails are always processed.
    if (isGeminiNotesEmail(from.email, subject, body)) {
      const result = await handleGeminiNotesPath({
        recruiterId,
        subject,
        body,
        from,
        occurredAt,
        messageId,
        host: req.headers.host || 'localhost:3000',
      })
      return res.status(200).json({ ok: true, gemini_notes: true, ...result })
    }

    // ── Guard 2: self-send ───────────────────────────────────────────────────
    // Protects against forwarding loops and the recruiter emailing themselves.
    if (recruiter.email && from.email === recruiter.email.toLowerCase()) {
      return res.status(200).json({ ok: true, skipped: 'self_send' })
    }

    // ── Guard 3: domain blocklist ────────────────────────────────────────────
    // Hard-coded noise sources — skip classifier API call entirely.
    if (isBlocklistedAddress(from.email)) {
      writeIngestionLog(recruiterId, from.email, subject, 'noise', 'blocklist', req.body)
      return res.status(200).json({ ok: true, skipped: 'blocklist' })
    }

    // ── Guard 4: List-Unsubscribe header ─────────────────────────────────────
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
        message_id:   messageId || null,
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

    // ── Write new_inbound action card (immediate — no loop wait) ─────────────
    // Surfaces the email on the Desk Tray the moment it arrives, even if the
    // candidate has no active pipeline (which the agent loop would have missed).
    try {
      const contentHash = crypto
        .createHash('sha256')
        .update(`${recruiterId}:${candidateId}:new_inbound:${interaction.id}`)
        .digest('hex')

      await supabase.from('actions').insert({
        recruiter_id:        recruiterId,
        action_type:         'new_inbound',
        linked_entity_id:    candidateId,
        linked_entity_type:  'candidate',
        urgency:             classification?.urgency ?? 'this_week',
        why:                 buildWhy(from.name, classification?.candidate_intent),
        suggested_next_step: pipelineId ? 'Draft a reply' : 'Add to a role',
        confidence:          'high',
        content_hash:        contentHash,
        context: {
          interaction_id: interaction.id,
          from_email:     from.email,
          subject:        subject || null,
          intent:         classification?.candidate_intent ?? null,
        },
      })
    } catch (actionErr) {
      console.warn('[ingest-email] new_inbound action insert failed:', actionErr.message)
    }

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
