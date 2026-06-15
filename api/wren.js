import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { buildWrenAgentSystem } from '../src/lib/prompts/wrenAgent.js'
import { buildScreenerMessages } from '../src/lib/prompts/resumeScreener.js'
import { bandFromScore } from '../src/lib/scoreBand.js'
import { buildSubmittalDraftPayload } from './_lib/buildSubmittalDraft.js'
import { buildOutreachEmailMessages } from '../src/lib/prompts/candidateOutreachEmail.js'
import { buildClassifyMessages, buildIntakeMessages } from '../src/lib/prompts/intake.js'
import { buildNotesExtractionMessages } from '../src/lib/prompts/notesExtraction.js'
import { matchCandidateWithConfidence, extractConversationCandidateIds } from './_lib/matchWithConfidence.js'
import { classifyMove, STAGES, LOST_REASONS, BACKWARD_REASONS } from '../src/lib/stages.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const config = {
  api: { bodyParser: { sizeLimit: '4mb' } },
  maxDuration: 60,
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

// Deterministic dash sanitizer — applied to all model-generated text before persist.
// Rules (spec order):
//   bounded (no spaces around): 2024–2025 → 2024-2025
//   spaced: 9/10 — recommend → 9/10, recommend
//   any remaining → ' - '
// Unicode: U+2012 figure dash, U+2013 en dash, U+2014 em dash, U+2015 horizontal bar.
const DASHES = /[‒–—―]/g

function sanitizeDashes(text) {
  if (typeof text !== 'string') return text
  return text
    .replace(/ -- /g, ', ')
    .replace(/(\S)[‒–—―](\S)/g, '$1-$2')
    .replace(/ [‒–—―] /g, ', ')
    .replace(DASHES, ' - ')
}

// Walk all string values in a render data object so the sanitizer covers
// screen result fields (career_trajectory, recommendation_reason, etc.)
// as well as draft_text — regardless of which prompt produced them.
function sanitizeRenderData(data) {
  if (!data || typeof data !== 'object') return data
  if (Array.isArray(data)) {
    return data.map(item => typeof item === 'string' ? sanitizeDashes(item) : sanitizeRenderData(item))
  }
  const out = {}
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string') out[k] = sanitizeDashes(v)
    else if (Array.isArray(v)) out[k] = v.map(item => typeof item === 'string' ? sanitizeDashes(item) : sanitizeRenderData(item))
    else if (v && typeof v === 'object') out[k] = sanitizeRenderData(v)
    else out[k] = v
  }
  return out
}

function parseName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean)
  return {
    first_name: parts[0] || 'Unknown',
    last_name: parts.slice(1).join(' ') || '',
  }
}

function parseJson(text) {
  try { return JSON.parse(text) } catch {}
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
  } catch {}
  return null
}

// Strip large text fields from tool results before persisting to conversation_messages.
// Keeps all IDs, names, structured fields, and judgment-relevant facts.
// Drops cv_text entirely (already extracted to timeline/skills).
// Caps notes/JD at 300 chars, debrief summaries at 150 chars (preserve objection patterns).
// The live agentic loop still gets full payloads; only persisted history is trimmed.
function truncateForHistory(toolName, result) {
  if (!result || result.error) return result
  switch (toolName) {
    case 'get_candidate': {
      const { cv_text, ...rest } = result
      return {
        ...rest,
        recent_interactions: (rest.recent_interactions || []).map(i => ({
          ...i,
          body: i.body ? i.body.slice(0, 200) : i.body,
        })),
      }
    }
    case 'get_role': {
      return {
        ...result,
        notes: result.notes ? result.notes.slice(0, 300) : result.notes,
        client_history: result.client_history ? {
          ...result.client_history,
          recent_debriefs: (result.client_history.recent_debriefs || []).map(d => ({
            ...d,
            summary: d.summary ? d.summary.slice(0, 150) : d.summary,
          })),
        } : result.client_history,
      }
    }
    case 'draft_submittal': {
      return {
        ...result,
        draft_text: result.draft_text ? result.draft_text.slice(0, 400) : result.draft_text,
      }
    }
    case 'ingest_input':
    case 'enrich_from_notes': {
      // Keep all structured fields; drop alternatives array (not needed in history)
      const { alternatives, ...rest } = result
      return rest
    }
    default:
      return result
  }
}

// Group conversation rows into turn units and keep the last maxTurns.
// A turn closes when a { type: 'message' } row is seen (final assistant response).
// The current open turn (recruiter message not yet answered) is always kept as one slot.
function boundHistory(rows, maxTurns = 10) {
  const turns = []
  let current = []
  for (const row of rows) {
    current.push(row)
    if (row.content?.type === 'message') {
      turns.push(current)
      current = []
    }
  }
  if (current.length) turns.push(current)
  return turns.slice(-maxTurns).flat()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: recruiter, error: rErr } = await supabase
    .from('recruiters')
    .select('id, full_name, email, gmail_access_token')
    .eq('user_id', user.id)
    .single()
  if (rErr || !recruiter) return res.status(401).json({ error: 'No recruiter profile' })

  const gmailConnected = !!recruiter.gmail_access_token

  const { conversation_id, message } = req.body
  if (!message?.trim()) return res.status(400).json({ error: 'message required' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  try {
    let convId = conversation_id
    if (!convId) {
      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .insert({ recruiter_id: recruiter.id })
        .select('id')
        .single()
      if (convErr) throw convErr
      convId = conv.id
      sse(res, 'conversation', { conversation_id: convId })
    }

    await supabase.from('conversation_messages').insert({
      conversation_id: convId,
      recruiter_id: recruiter.id,
      role: 'user',
      content: { type: 'text', text: message },
    })

    const { data: rawHistory } = await supabase
      .from('conversation_messages')
      .select('role, content, created_at')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })

    // Bound to last 10 turn groups (9 complete prior turns + current open turn)
    const bounded = boundHistory(rawHistory || [])
    const apiMessages = buildApiMessages(bounded)
    const system = buildWrenAgentSystem(recruiter, { gmailConnected })
    const tools = getToolDefinitions()

    // Candidate IDs mentioned in prior turns — used for salience scoring in confidence matching
    const convContext = { candidateIds: extractConversationCandidateIds(bounded) }

    const { fullText, renders, toolSteps, _errorSent } = await runAgentLoop(apiMessages, system, tools, recruiter, res, convContext)

    // Tool threw mid-loop — error already sent and stream already closed
    if (_errorSent) return

    // Sanitize model output before persist — removes em/en dashes from all text
    // fields in both conversational text and render data (covers draft_text, screen
    // result fields like recommendation_reason, career_trajectory, etc.).
    // User messages are never touched — only the model-generated side of the turn.
    const persistText = sanitizeDashes(fullText)
    const persistRenders = renders.map(r => ({ tool: r.tool, data: sanitizeRenderData(r.data) }))

    // Save tool steps before the final message so created_at ordering is preserved
    if (toolSteps.length > 0) {
      await supabase.from('conversation_messages').insert({
        conversation_id: convId,
        recruiter_id: recruiter.id,
        role: 'assistant',
        content: { type: 'turn_steps', steps: toolSteps },
      })
    }

    const { data: savedMsg } = await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: convId,
        recruiter_id: recruiter.id,
        role: 'assistant',
        content: { type: 'message', text: persistText, renders: persistRenders },
      })
      .select('id')
      .single()

    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', convId)

    sse(res, 'done', { conversation_id: convId, message_id: savedMsg?.id })
    res.end()
  } catch (err) {
    console.error('[api/wren]', err)
    sse(res, 'error', { message: err.message })
    res.end()
  }
}

// Reconstruct the Anthropic messages array from persisted conversation history.
//
// Content type dispatch:
//   'text'       — recruiter prose → forwarded as string content
//   'turn_steps' — agentic loop steps (tool_use + tool_result pairs + final text)
//                  → expanded into the interleaved Anthropic format the API requires
//   'message'    — final assistant response → forwarded as string content ONLY when
//                  no turn_steps row preceded it (i.e. no tool calls that turn).
//                  When turn_steps is present, the final text is already in the last
//                  step's 'final' entry; the message row is UI-only in that case.
//
// Renders (ScreenResult, SubmittalDraft) live in message.renders and never reach here.
// Tool-result data persists via turn_steps with truncated payloads.
function buildApiMessages(history) {
  const msgs = []
  let prevWasToolSteps = false

  for (const row of history) {
    const ct = row.content
    if (!ct) continue

    if (ct.type === 'text') {
      if (ct.text) msgs.push({ role: row.role, content: ct.text })
      prevWasToolSteps = false
    } else if (ct.type === 'turn_steps') {
      for (const step of (ct.steps || [])) {
        if (step.type === 'tool_step') {
          if (step.assistant?.length) msgs.push({ role: 'assistant', content: step.assistant })
          if (step.user?.length)      msgs.push({ role: 'user',      content: step.user })
        } else if (step.type === 'final') {
          if (step.text) msgs.push({ role: 'assistant', content: step.text })
        }
      }
      prevWasToolSteps = true
    } else if (ct.type === 'message') {
      // Skip when turn_steps already carried the final text for this turn
      if (!prevWasToolSteps && ct.text) msgs.push({ role: 'assistant', content: ct.text })
      prevWasToolSteps = false
    }
    // Unknown types silently skipped (forward compat)
  }

  return msgs
}

async function runAgentLoop(initialMessages, system, tools, recruiter, res, convContext = {}) {
  const messages = [...initialMessages]
  const renders = []
  const toolSteps = []  // persisted across-turn context; see turn_steps in conversation_messages
  let fullText = ''

  while (true) {
    let iterText = ''  // text emitted by this loop iteration only

    const stream = anthropic.messages.stream({
      model: process.env.AI_MODEL || 'claude-sonnet-4-6',
      max_tokens: 4000,
      system,
      messages,
      tools,
    })

    stream.on('text', (chunk) => {
      fullText += chunk
      iterText += chunk
      sse(res, 'text', { text: chunk })
    })

    const finalMsg = await stream.finalMessage()

    if (finalMsg.stop_reason === 'end_turn') {
      toolSteps.push({ type: 'final', text: iterText })
      break
    }

    if (finalMsg.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: finalMsg.content })
      const toolResults = []

      // Index tool_use blocks by ID for truncation mapping
      const blockById = {}
      for (const block of finalMsg.content) {
        if (block.type === 'tool_use') blockById[block.id] = block
      }

      for (const block of finalMsg.content) {
        if (block.type !== 'tool_use') continue
        sse(res, 'tool_call', { name: block.name })
        let result
        try {
          result = await executeTool(block.name, block.input, recruiter, convContext)
        } catch (toolErr) {
          console.error(`[wren] tool ${block.name} threw:`, toolErr)
          sse(res, 'error', { message: toolErr.message || `Tool ${block.name} failed` })
          res.end()
          return { fullText, renders, toolSteps, _errorSent: true }
        }
        renders.push({ tool: block.name, data: result })
        sse(res, 'tool_result', { tool: block.name, data: result })
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        })
      }

      messages.push({ role: 'user', content: toolResults })

      // Build truncated version of tool results for persistence
      const truncatedResults = toolResults.map(tr => {
        const block = blockById[tr.tool_use_id]
        let parsed
        try { parsed = JSON.parse(tr.content) } catch { parsed = null }
        const trimmed = block && parsed ? truncateForHistory(block.name, parsed) : parsed
        return { ...tr, content: JSON.stringify(trimmed ?? {}) }
      })

      toolSteps.push({
        type: 'tool_step',
        assistant: finalMsg.content,  // tool_use blocks (+ any pre-call text)
        user: truncatedResults,       // tool_result blocks with trimmed payloads
      })

      // Inject newline between iterations so pre-tool preamble and post-tool
      // text don't run together when the next iteration emits text immediately.
      if (iterText.trim()) {
        fullText += '\n'
        sse(res, 'text', { text: '\n' })
      }
    } else {
      // Unexpected stop reason — capture text and exit
      if (iterText) toolSteps.push({ type: 'final', text: iterText })
      break
    }
  }

  return { fullText, renders, toolSteps }
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

function getToolDefinitions() {
  return [
    {
      name: 'search_db',
      description: "Search the recruiter's database for candidates, roles, or companies by name, title, or keyword. Use this to resolve a name to an ID before calling get_candidate, get_role, or get_company.",
      input_schema: {
        type: 'object',
        properties: {
          entity_type: { type: 'string', enum: ['candidate', 'role', 'company'] },
          query: { type: 'string', description: 'Name, company, title, or keyword to search' },
        },
        required: ['entity_type', 'query'],
      },
    },
    {
      name: 'get_candidate',
      description: 'Retrieve a full candidate record: CV text, career timeline, skills, active pipeline entries, recent interactions.',
      input_schema: {
        type: 'object',
        properties: {
          candidate_id: { type: 'string' },
        },
        required: ['candidate_id'],
      },
    },
    {
      name: 'get_role',
      description: 'Retrieve a full role record: JD, process steps, comp range, and client objection history from recent debriefs across all candidates at this client.',
      input_schema: {
        type: 'object',
        properties: {
          role_id: { type: 'string' },
        },
        required: ['role_id'],
      },
    },
    {
      name: 'get_company',
      description: 'Retrieve a company/client record: name, industry, location, open roles with their agreement status, and count of candidates currently in flight.',
      input_schema: {
        type: 'object',
        properties: {
          client_id: { type: 'string' },
        },
        required: ['client_id'],
      },
    },
    {
      name: 'screen_candidate',
      description: 'Run the screener skill for a candidate against a role. Returns structured result: match score, strengths, concerns, red flags, recommendation. Client objection history is incorporated automatically when role_id is provided.',
      input_schema: {
        type: 'object',
        properties: {
          role_id: { type: 'string', description: 'Required. The role to screen against.' },
          candidate_id: { type: 'string', description: 'DB candidate ID. Provide if the candidate is in the system.' },
          resume_text: { type: 'string', description: 'Raw resume text. Provide when the recruiter pasted a resume for a candidate not in the system.' },
        },
        required: ['role_id'],
      },
    },
    {
      name: 'draft_submittal',
      description: 'Draft a candidate submittal for a role. Always include the complete draft in your response. mode "internal" produces the recruiter-facing breakdown (flags up, never sent). mode "external" produces the HM-ready version (flags resolved, sendable). For revisions of either surface, pass prior_draft (full text from conversation) and revision_instruction.',
      input_schema: {
        type: 'object',
        properties: {
          role_id: { type: 'string' },
          candidate_id: { type: 'string', description: 'If candidate is in the system.' },
          resume_text: { type: 'string', description: 'Raw resume text if candidate is not in the system.' },
          mode: { type: 'string', enum: ['internal', 'external'], description: 'Default: internal. Use external when the recruiter asks for the HM-ready version.' },
          format: { type: 'string', enum: ['bulleted', 'paragraph', 'concise', 'linkedin'], description: 'External surface only. Default: bulleted. concise = Slack-ready. linkedin = outbound DM, under 90 words.' },
          resolved_flags: { type: 'string', description: 'External mode only. Summarize what was resolved in this conversation before calling — e.g., "comp aligned per recruiter, tenure flag dropped, motivation: leaving because no AE path at current company".' },
          prior_draft: { type: 'string', description: 'Full text of the previous draft when revising.' },
          revision_instruction: { type: 'string', description: "The recruiter's instruction for revising the prior draft." },
        },
        required: ['role_id'],
      },
    },
    {
      name: 'draft_outreach',
      description: 'Draft an outreach email to a candidate for a role. Returns subject and body.',
      input_schema: {
        type: 'object',
        properties: {
          candidate_id: { type: 'string' },
          role_id: { type: 'string', description: 'Optional. Include for role-specific outreach.' },
        },
        required: ['candidate_id'],
      },
    },
    {
      name: 'add_to_pipeline',
      description: "Add a candidate to a role's pipeline at the submitted stage. This is the only tool that creates a pipeline entry. Call when: (1) the recruiter explicitly says to add someone to a role, or (2) the recruiter accepts a placement offer after a screen or draft (suggest_pipeline was true and they said yes). Always announce what was done. Never call this without explicit recruiter instruction or acceptance.",
      input_schema: {
        type: 'object',
        properties: {
          candidate_id: { type: 'string', description: 'DB candidate ID.' },
          role_id: { type: 'string', description: 'DB role ID.' },
        },
        required: ['candidate_id', 'role_id'],
      },
    },
    {
      name: 'move_stage',
      description: "Move a candidate to a new stage in the pipeline. Updates current_stage and writes a pipeline_stage_history row — the velocity clock reads entered_at, so this write is load-bearing. Identify the pipeline by pipeline_id OR by candidate_id + role_id. For backward moves, pass backward_reason. For a 'correction' backward move, the tool attempts to remove the erroneous history row cleanly; if interactions or debriefs were logged since the move, it appends a correction row instead. For terminal 'lost', pass lost_reason. For terminal 'placed', pass start_date (ISO date or omit if unknown) and optionally guarantee_days.",
      input_schema: {
        type: 'object',
        properties: {
          pipeline_id:     { type: 'string', description: 'Pipeline row ID. Use when known from a prior tool call.' },
          candidate_id:    { type: 'string', description: 'Candidate ID. Use with role_id when pipeline_id is not known.' },
          role_id:         { type: 'string', description: 'Role ID. Use with candidate_id when pipeline_id is not known.' },
          target_stage:    { type: 'string', enum: ['submitted', 'first_round', 'middle_round', 'final_round', 'offer', 'placed', 'lost'], description: 'Stage to move to.' },
          backward_reason: { type: 'string', enum: ['client_added_step', 'candidate_bumped', 'correction', 'other'], description: 'Required for backward moves.' },
          lost_reason:     { type: 'string', enum: ['rejected', 'withdrawn', 'counteroffer', 'lost_to_offer', 'role_closed', 'fell_through', 'unresponsive', 'comp', 'other'], description: 'Required when target_stage is "lost".' },
          start_date:      { type: 'string', description: 'ISO date (YYYY-MM-DD). Candidate start date for placed stage. Omit if unknown — can be added later.' },
          guarantee_days:  { type: 'integer', description: 'Guarantee period in days. Default 90. Override only when the recruiter specifies.' },
          notes:           { type: 'string', description: 'Optional context for this transition. Pass if the recruiter volunteers color.' },
        },
        required: ['target_stage'],
      },
    },
    {
      name: 'ingest_input',
      description: "Classify and persist a pasted document (resume, JD, or call notes). Call this immediately when the recruiter's message contains a <document type=\"paste\"> block. Classifies the content, creates or enriches the matching record (candidate, company + role, or candidate interaction), and returns what was done. Never ask the recruiter to confirm before calling — act on high-confidence matches, ask only when genuinely ambiguous.",
      input_schema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The full content of the pasted document.' },
        },
        required: ['text'],
      },
    },
    {
      name: 'enrich_from_notes',
      description: 'Persist call notes or a transcript to a candidate record. Use when the recruiter pastes notes in conversation (not via paste-block) or explicitly asks to save notes for a specific candidate. If candidate_id is known from context, pass it — skips matching. Otherwise resolves the candidate by name using confidence-gated matching.',
      input_schema: {
        type: 'object',
        properties: {
          notes_text: { type: 'string', description: 'The call notes or transcript text.' },
          candidate_id: { type: 'string', description: 'Pass when the candidate is already identified in this conversation.' },
        },
        required: ['notes_text'],
      },
    },
    {
      name: 'connect_google',
      description: 'Surface the Gmail connect UI. Call this when the recruiter asks about sending email, connecting Gmail, or connecting Google — including when their access was revoked and they need to reconnect.',
      input_schema: { type: 'object', properties: {} },
    },
    {
      name: 'create_role',
      description: "Create a new role record (and its client if it doesn't exist). Call when: (1) the recruiter explicitly says to create or add a role, (2) ingest_input returned action 'ask' for a JD match and the recruiter rejected the proposed match, or (3) a bare instruction names a title and company. Checks for duplicates — returns already_exists if the same title already exists at that company.",
      input_schema: {
        type: 'object',
        properties: {
          title:   { type: 'string', description: 'Role title.' },
          company: { type: 'string', description: 'Company / client name.' },
          location: { type: 'string', description: 'Optional. Company HQ or role location.' },
          notes:   { type: 'string', description: 'Optional. Raw JD text or any notes to attach to the role record.' },
        },
        required: ['title', 'company'],
      },
    },
    {
      name: 'create_candidate',
      description: "Create a new candidate record. Call when: (1) the recruiter explicitly says to add or create a candidate, (2) ingest_input returned action 'ask' and the recruiter rejected all alternatives and wants a new record. Pass extracted fields from the ingest_input result when available.",
      input_schema: {
        type: 'object',
        properties: {
          name:            { type: 'string', description: 'Full name.' },
          email:           { type: 'string', description: 'Optional.' },
          current_title:   { type: 'string', description: 'Optional.' },
          current_company: { type: 'string', description: 'Optional.' },
          cv_text:         { type: 'string', description: 'Optional. Raw resume text if available.' },
        },
        required: ['name'],
      },
    },
  ]
}

// ─── Tool execution ───────────────────────────────────────────────────────────

async function executeTool(name, input, recruiter, convContext = {}) {
  switch (name) {
    case 'search_db':        return toolSearchDb(input, recruiter, convContext)
    case 'get_candidate':    return toolGetCandidate(input, recruiter)
    case 'get_role':         return toolGetRole(input, recruiter)
    case 'get_company':      return toolGetCompany(input, recruiter)
    case 'screen_candidate': return toolScreenCandidate(input, recruiter)
    case 'draft_submittal':  return toolDraftSubmittal(input, recruiter)
    case 'draft_outreach':   return toolDraftOutreach(input, recruiter)
    case 'add_to_pipeline':   return toolAddToPipeline(input, recruiter)
    case 'move_stage':        return toolMoveStage(input, recruiter)
    case 'ingest_input':      return toolIngestInput(input, recruiter, convContext)
    case 'enrich_from_notes': return toolEnrichFromNotes(input, recruiter, convContext)
    case 'connect_google':    return { action: 'connect', connected: false }
    case 'create_role':       return toolCreateRole(input, recruiter)
    case 'create_candidate':  return toolCreateCandidate(input, recruiter)
    default:                  return { error: `Unknown tool: ${name}` }
  }
}

async function toolSearchDb({ entity_type, query }, recruiter, convContext = {}) {
  if (entity_type === 'candidate') {
    const tokens = query.trim().split(/\s+/).filter(t => t.length >= 2)
    if (!tokens.length) return { results: [] }

    if (tokens.length === 1) {
      const { data } = await supabase
        .from('candidates')
        .select('id, first_name, last_name, current_title, current_company')
        .eq('recruiter_id', recruiter.id)
        .or(`first_name.ilike.%${tokens[0]}%,last_name.ilike.%${tokens[0]}%,current_company.ilike.%${tokens[0]}%`)
        .limit(5)
      return { results: data || [] }
    }

    // Multi-token: pair logic for first two tokens (forward + reversed) covers the
    // standard "First Last" case. Each remaining token gets its own standalone search
    // so 3+ token names (e.g. "Mary Jane Watson") always resolve by at least one token.
    const [a, b] = tokens
    const queries = [
      supabase.from('candidates')
        .select('id, first_name, last_name, current_title, current_company')
        .eq('recruiter_id', recruiter.id).ilike('first_name', `%${a}%`).ilike('last_name', `%${b}%`).limit(5),
      supabase.from('candidates')
        .select('id, first_name, last_name, current_title, current_company')
        .eq('recruiter_id', recruiter.id).ilike('first_name', `%${b}%`).ilike('last_name', `%${a}%`).limit(5),
      ...tokens.slice(2).map(t =>
        supabase.from('candidates')
          .select('id, first_name, last_name, current_title, current_company')
          .eq('recruiter_id', recruiter.id)
          .or(`first_name.ilike.%${t}%,last_name.ilike.%${t}%,current_company.ilike.%${t}%`)
          .limit(5)
      ),
    ]
    const settled = await Promise.all(queries)
    const combined = settled.flatMap(r => r.data || [])
    const unique = combined.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i)

    // Attach salience match to help the model resolve "Annie" to the active Annie
    const convCandidateIds = convContext.candidateIds || new Set()
    if (unique.length > 1 && query.trim().split(/\s+/).length <= 3) {
      const nameMatch = await matchCandidateWithConfidence(
        { name: query },
        recruiter.id,
        supabase,
        convCandidateIds
      )
      if (nameMatch.action === 'act' && nameMatch.match) {
        // Surface the best match first with confidence label
        const sorted = [
          nameMatch.match,
          ...unique.filter(c => c.id !== nameMatch.match.id),
        ]
        return {
          results: sorted.slice(0, 5),
          best_match: nameMatch.match.id,
          best_match_confidence: nameMatch.confidence,
          best_match_label: nameMatch.salience_label,
        }
      }
    }

    return { results: unique.slice(0, 5) }
  }
  if (entity_type === 'role') {
    // No status filter — named lookup finds roles regardless of status.
    // Status is in the SELECT so the model can act on it.
    const tokens = query.trim().split(/\s+/).filter(t => t.length >= 2)
    if (!tokens.length) return { results: [] }

    // Run all searches in parallel:
    // full-phrase against title and client (handles exact matches efficiently),
    // then per-token against title and client for cross-field compound queries
    // (e.g. "Unit Sales Development" where client="Unit" and title="Sales Development ...").
    const [fullByTitle, fullByClient, ...tokenResults] = await Promise.all([
      supabase.from('roles').select('id, title, status, clients(name)')
        .eq('recruiter_id', recruiter.id).ilike('title', `%${query}%`).limit(5),
      supabase.from('roles').select('id, title, status, clients!inner(name)')
        .eq('recruiter_id', recruiter.id).ilike('clients.name', `%${query}%`).limit(5),
      ...tokens.map(t =>
        supabase.from('roles').select('id, title, status, clients(name)')
          .eq('recruiter_id', recruiter.id).ilike('title', `%${t}%`).limit(10)
      ),
      ...tokens.map(t =>
        supabase.from('roles').select('id, title, status, clients!inner(name)')
          .eq('recruiter_id', recruiter.id).ilike('clients.name', `%${t}%`).limit(10)
      ),
    ])

    const nTokens = tokens.length
    const titleTokenResults = tokenResults.slice(0, nTokens)
    const clientTokenResults = tokenResults.slice(nTokens)

    // Full-phrase matches — highest precision
    const fullMatches = [...(fullByTitle.data || []), ...(fullByClient.data || [])]

    // Cross-field matches: role appears in ≥1 title-token result AND ≥1 client-token result.
    // This is what resolves "Unit Sales Development" → client "Unit" AND title "Sales Development...".
    const clientTokenIds = new Set(clientTokenResults.flatMap(r => (r.data || []).map(x => x.id)))
    const crossMatches = titleTokenResults
      .flatMap(r => r.data || [])
      .filter(r => clientTokenIds.has(r.id))

    // Per-token fallback: any single-field match across all tokens
    const tokenFallback = [...titleTokenResults, ...clientTokenResults].flatMap(r => r.data || [])

    // Priority: full matches → cross-field → per-token fallback
    const prioritized = [...fullMatches, ...crossMatches, ...tokenFallback]
    const unique = prioritized.filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i)
    return { results: unique.slice(0, 5) }
  }
  if (entity_type === 'company') {
    const { data } = await supabase
      .from('clients')
      .select('id, name, industry')
      .eq('recruiter_id', recruiter.id)
      .ilike('name', `%${query}%`)
      .limit(5)
    return { results: (data || []).map(c => ({ ...c, type: 'company' })) }
  }
  return { results: [] }
}

async function toolGetCandidate({ candidate_id }, recruiter) {
  const { data: candidate, error } = await supabase
    .from('candidates')
    .select('id, first_name, last_name, current_title, current_company, location, email, phone, skills, cv_text, career_timeline, notes, career_signals, enrichment_data')
    .eq('id', candidate_id)
    .eq('recruiter_id', recruiter.id)
    .single()
  if (error || !candidate) return { error: 'Candidate not found' }

  const { data: interactions } = await supabase
    .from('interactions')
    .select('type, direction, body, occurred_at')
    .eq('candidate_id', candidate_id)
    .eq('recruiter_id', recruiter.id)
    .order('occurred_at', { ascending: false })
    .limit(5)

  const { data: pipelines } = await supabase
    .from('pipelines')
    .select('id, current_stage, fit_score, expected_comp, roles(id, title, clients(name))')
    .eq('candidate_id', candidate_id)
    .eq('recruiter_id', recruiter.id)
    .not('current_stage', 'in', '(placed,lost)')

  // Merge enrichment_data (old write path) into career_signals (new canonical location).
  // enrichment_data fills gaps; career_signals wins per key. Strip enrichment_data from result.
  const resolvedSignals = {
    ...(candidate.enrichment_data || {}),
    ...(candidate.career_signals || {}),
  }
  const { enrichment_data: _ed, ...candidateRest } = candidate
  return { ...candidateRest, career_signals: resolvedSignals, recent_interactions: interactions || [], active_pipelines: pipelines || [] }
}

async function toolGetRole({ role_id }, recruiter) {
  const { data: role, error } = await supabase
    .from('roles')
    .select('id, title, status, notes, process_steps, comp_min, comp_max, comp_type, target_comp_min, target_comp_max, agreement_status, clients(id, name, industry, notes)')
    .eq('id', role_id)
    .eq('recruiter_id', recruiter.id)
    .single()
  if (error || !role) return { error: 'Role not found' }

  const { count: pipelineCount } = await supabase
    .from('pipelines')
    .select('id', { count: 'exact', head: true })
    .eq('role_id', role_id)
    .eq('recruiter_id', recruiter.id)
    .not('current_stage', 'in', '(placed,lost)')

  const clientId = role.clients?.id
  let clientHistory = { recent_debriefs: [] }

  if (clientId) {
    const { data: clientRoles } = await supabase
      .from('roles')
      .select('id')
      .eq('client_id', clientId)
      .eq('recruiter_id', recruiter.id)

    const roleIds = (clientRoles || []).map(r => r.id)
    if (roleIds.length > 0) {
      const { data: pipelines } = await supabase
        .from('pipelines')
        .select('id, candidates(first_name, last_name)')
        .in('role_id', roleIds)
        .eq('recruiter_id', recruiter.id)

      const pipelineIds = (pipelines || []).map(p => p.id)
      if (pipelineIds.length > 0) {
        const { data: debriefs } = await supabase
          .from('debriefs')
          .select('outcome, summary, risk_flags, competitive_signals, created_at, pipeline_id')
          .in('pipeline_id', pipelineIds)
          .order('created_at', { ascending: false })
          .limit(5)

        clientHistory.recent_debriefs = (debriefs || []).map(d => {
          const pipeline = pipelines.find(p => p.id === d.pipeline_id)
          return {
            candidate_name: pipeline?.candidates
              ? `${pipeline.candidates.first_name} ${pipeline.candidates.last_name}`
              : 'Unknown',
            outcome: d.outcome,
            summary: d.summary,
            risk_flags: d.risk_flags,
            date: d.created_at?.slice(0, 10),
          }
        })
      }
    }
  }

  return { ...role, client_history: clientHistory, pipeline_count: pipelineCount ?? 0 }
}

async function toolGetCompany({ client_id }, recruiter) {
  const { data: client, error } = await supabase
    .from('clients')
    .select('id, name, industry, hq_location')
    .eq('id', client_id)
    .eq('recruiter_id', recruiter.id)
    .single()
  if (error || !client) return { error: 'Company not found' }

  const { data: roles } = await supabase
    .from('roles')
    .select('id, title, status, agreement_status')
    .eq('client_id', client_id)
    .eq('recruiter_id', recruiter.id)

  const openRoles = (roles || []).filter(r => r.status === 'open')

  let candidates_in_flight = 0
  if (openRoles.length > 0) {
    const openRoleIds = openRoles.map(r => r.id)
    const { count } = await supabase
      .from('pipelines')
      .select('id', { count: 'exact', head: true })
      .in('role_id', openRoleIds)
      .eq('recruiter_id', recruiter.id)
      .not('current_stage', 'in', '(placed,lost)')
    candidates_in_flight = count ?? 0
  }

  return { ...client, open_roles: openRoles, candidates_in_flight }
}

async function toolScreenCandidate({ role_id, candidate_id, resume_text }, recruiter) {
  const roleData = await toolGetRole({ role_id }, recruiter)
  if (roleData.error) return roleData

  let candidateData
  if (candidate_id) {
    candidateData = await toolGetCandidate({ candidate_id }, recruiter)
    if (candidateData.error) return candidateData
  } else if (resume_text) {
    candidateData = {
      first_name: 'Candidate', last_name: '(pasted)',
      current_title: null, current_company: null, location: null,
      skills: [], cv_text: resume_text, career_timeline: [], notes: null,
      _from_paste: true,
    }
  } else {
    return { error: 'Provide candidate_id or resume_text' }
  }

  const messages = buildScreenerMessages(candidateData, roleData, roleData.client_history)
  // Haiku: screener is structured JSON extraction (score, strengths, concerns, red flags).
  // ~3-5x faster and cheaper than Sonnet. If client-objection-pattern insight gets blander
  // or output quality drops noticeably, revert this model to process.env.AI_MODEL.
  const aiRes = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages,
  })

  const raw = aiRes.content[0]?.text ?? ''
  let result = null
  try {
    result = JSON.parse(raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim())
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) try { result = JSON.parse(match[0]) } catch {}
  }
  if (!result) return { error: 'Screen parse failed', raw: raw.slice(0, 300) }

  result.recommendation = bandFromScore(result.match_score)

  return {
    ...result,
    from_paste: !!candidateData._from_paste,
    role_title: roleData.title,
    client_name: roleData.clients?.name,
    // Offer pipeline placement — do not auto-place. Only add_to_pipeline writes pipeline.
    suggest_pipeline: !candidateData._from_paste && !!candidate_id
      && result.recommendation === 'advance',
  }
}

async function toolDraftSubmittal({ role_id, candidate_id, resume_text, mode = 'internal', format = 'bulleted', resolved_flags = '', prior_draft, revision_instruction }, recruiter) {
  // Revision path — stays inline. A revision rewrites a specific prior draft, not a
  // source regeneration. Candidate/role are fetched only for return object metadata.
  if (revision_instruction && prior_draft) {
    const roleData = await toolGetRole({ role_id }, recruiter)
    if (roleData.error) return roleData

    let candidateData
    if (candidate_id) {
      candidateData = await toolGetCandidate({ candidate_id }, recruiter)
      if (candidateData.error) return candidateData
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

    const aiRes = await anthropic.messages.create({
      model: process.env.AI_MODEL || 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: buildRevisionMessages(prior_draft, revision_instruction),
    })

    let pipeline_id = null
    if (candidate_id && role_id && !candidateData._from_paste) {
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
      draft_text: aiRes.content[0]?.text ?? '',
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
      is_revision: true,
      gmail_connected: !!recruiter.gmail_access_token,
      // Offer pipeline placement — do not auto-place. Only add_to_pipeline writes pipeline.
      suggest_pipeline: !candidateData._from_paste && !!candidate_id,
    }
  }

  // Fresh draft — delegate to shared lib
  const result = await buildSubmittalDraftPayload(
    { role_id, candidate_id, resume_text, mode, format, resolved_flags },
    recruiter
  )
  return result.error ? result : { ...result, is_revision: false }
}

function buildRevisionMessages(priorDraft, instruction) {
  return [{
    role: 'user',
    content: `You are revising a candidate submission draft per a recruiter's instruction.

ORIGINAL DRAFT:
${priorDraft}

REVISION INSTRUCTION:
${instruction}

Apply the instruction. Return only the revised draft — no intro, no "here's the revision:", just the draft. Preserve everything not mentioned in the instruction. Same format and surface type as the original. Same writing rules: no em dashes, no AI filler, recruiter voice, short sentences, facts not characterization. Do not introduce facts not present in the original draft or the revision instruction.`,
  }]
}

async function toolDraftOutreach({ candidate_id, role_id }, recruiter) {
  const candidateData = await toolGetCandidate({ candidate_id }, recruiter)
  if (candidateData.error) return candidateData

  let roleData = null
  if (role_id) {
    const r = await toolGetRole({ role_id }, recruiter)
    if (!r.error) roleData = r
  }

  const { data: voiceSamples } = await supabase
    .from('voice_samples')
    .select('channel, subject, body')
    .eq('recruiter_id', recruiter.id)
    .in('channel', ['email', 'linkedin'])
    .limit(3)

  const messages = buildOutreachEmailMessages(candidateData, roleData, voiceSamples || [])
  const aiRes = await anthropic.messages.create({
    model: process.env.AI_MODEL || 'claude-sonnet-4-6',
    max_tokens: 500,
    messages,
  })

  const raw = aiRes.content[0]?.text ?? ''
  let result = null
  try {
    result = JSON.parse(raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim())
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) try { result = JSON.parse(match[0]) } catch {}
  }
  return result ?? { subject: '', body: raw }
}

// ─── Ingest tools ─────────────────────────────────────────────────────────────

async function toolIngestInput({ text }, recruiter, convContext = {}) {
  if (!text?.trim()) return { error: 'No text provided' }

  // Step 1: Classify (cheap — 100 tokens, 2000-char slice)
  const classifyMsgs = buildClassifyMessages(text)
  const classifyRes = await anthropic.messages.create({
    model: process.env.AI_MODEL || 'claude-sonnet-4-6',
    max_tokens: classifyMsgs.maxTokens,
    system: classifyMsgs.system,
    messages: classifyMsgs.messages,
  })
  let classification = { type: 'notes', label: 'Document' }
  const classifyRaw = classifyRes.content[0]?.text ?? ''
  const classifyParsed = parseJson(classifyRaw)
  if (classifyParsed?.type) classification = classifyParsed

  const type = classification.type

  // Step 2: Route by type
  if (type === 'resume') {
    return ingestResume(text, classification, recruiter, convContext)
  }
  if (type === 'jd') {
    return ingestJd(text, classification, recruiter)
  }
  // transcript and notes both go through the notes path
  return ingestNotes(text, classification, recruiter, convContext)
}

async function ingestResume(text, classification, recruiter, convContext) {
  // Resume creates/enriches candidate only — no role context, no pipeline entry.
  // Passing existingRoles here caused "only option" false matches (Unit SDR bug).
  // Role matching belongs to the JD path; placement belongs to add_to_pipeline.
  const intakeMsgs = buildIntakeMessages(text, [])
  const intakeRes = await anthropic.messages.create({
    model: process.env.AI_MODEL || 'claude-sonnet-4-6',
    max_tokens: intakeMsgs.maxTokens,
    system: intakeMsgs.system,
    messages: intakeMsgs.messages,
  })
  const extracted = parseJson(intakeRes.content[0]?.text ?? '')
  if (!extracted) return { classification: classification.type, label: classification.label, error: 'Extraction failed' }

  const c = extracted.candidate || {}
  if (!c.name && !c.email) {
    return { classification: classification.type, label: classification.label, error: 'No candidate name found in resume' }
  }

  // Confidence-gated match
  const matchResult = await matchCandidateWithConfidence(
    { name: c.name, email: c.email },
    recruiter.id,
    supabase,
    convContext.candidateIds || new Set()
  )

  const { first_name, last_name } = parseName(c.name)

  if (matchResult.action === 'ask') {
    return {
      classification: classification.type,
      label: classification.label,
      action: 'ask',
      alternatives: matchResult.alternatives,
      extracted_name: c.name,
      extracted_first_name: first_name,
      extracted_last_name: last_name,
      extracted_email: c.email || null,
      extracted_current_title: c.current_title || null,
      extracted_current_company: c.current_company || null,
    }
  }

  // Persist candidate (create or enrich)
  const mergedEnrichment = {
    ...(c.signals        && { signals: c.signals }),
    ...(c.career_summary && { career_summary: c.career_summary }),
    ...(extracted.pitch?.one_liner && { intake_pitch: extracted.pitch.one_liner }),
  }

  const candidatePayload = {
    recruiter_id: recruiter.id,
    first_name,
    last_name,
    ...(c.email           && { email: c.email }),
    ...(c.current_title   && { current_title: c.current_title }),
    ...(c.current_company && { current_company: c.current_company }),
    ...(c.cv_text         && { cv_text: c.cv_text }),
  }

  let candidateId
  let action

  if (matchResult.action === 'act' && matchResult.match) {
    const { data: current } = await supabase
      .from('candidates').select('enrichment_data').eq('id', matchResult.match.id).single()
    await supabase.from('candidates').update({
      ...candidatePayload,
      enrichment_data: { ...(current?.enrichment_data || {}), ...mergedEnrichment },
    }).eq('id', matchResult.match.id)
    candidateId = matchResult.match.id
    action = 'enriched'
  } else {
    const { data, error } = await supabase
      .from('candidates')
      .insert({ ...candidatePayload, enrichment_data: mergedEnrichment })
      .select('id').single()
    if (error) return { classification: classification.type, label: classification.label, error: error.message }
    candidateId = data.id
    action = 'created'
  }

  const name = `${first_name} ${last_name}`.trim()
  return {
    classification: classification.type,
    label: classification.label,
    action,
    entity_type: 'candidate',
    candidate_id: candidateId,
    name,
    current_title: c.current_title || null,
    current_company: c.current_company || null,
    what_happened: action === 'enriched'
      ? `Enriched ${name}'s record with resume`
      : `Created candidate record for ${name}`,
  }
}

async function ingestJd(text, classification, recruiter) {
  // Full intake to extract role fields
  const { data: existingRoles } = await supabase
    .from('roles').select('id, title, clients(name)')
    .eq('recruiter_id', recruiter.id).eq('status', 'open')

  const intakeMsgs = buildIntakeMessages(text, existingRoles || [])
  const intakeRes = await anthropic.messages.create({
    model: process.env.AI_MODEL || 'claude-sonnet-4-6',
    max_tokens: intakeMsgs.maxTokens,
    system: intakeMsgs.system,
    messages: intakeMsgs.messages,
  })
  const extracted = parseJson(intakeRes.content[0]?.text ?? '')
  if (!extracted) return { classification: classification.type, label: classification.label, error: 'Extraction failed' }

  if (!extracted.role?.title || !extracted.role?.company) {
    return { classification: classification.type, label: classification.label, error: 'No role title or company found in JD' }
  }

  // If intake matched to an existing role, ask before writing anything (single-write-path)
  if (extracted.role?.role_id) {
    const { data: matchedRole } = await supabase
      .from('roles').select('id, title, clients(name)')
      .eq('id', extracted.role.role_id).eq('recruiter_id', recruiter.id)
      .maybeSingle()

    if (matchedRole) {
      return {
        classification: classification.type,
        label: classification.label,
        action: 'ask',
        match: {
          role_id: matchedRole.id,
          title: matchedRole.title,
          company: matchedRole.clients?.name,
        },
        extracted_title: extracted.role.title,
        extracted_company: extracted.role.company,
      }
    }
    // Matched role no longer exists — fall through to create
    delete extracted.role.role_id
  }

  const result = await persistRole(extracted, text, recruiter)
  return { classification: classification.type, label: classification.label, ...result }
}

async function ingestNotes(text, classification, recruiter, convContext) {
  // Targeted extraction (cheap — 800 tokens)
  const notesMsgs = buildNotesExtractionMessages(text)
  const notesRes = await anthropic.messages.create({
    model: process.env.AI_MODEL || 'claude-sonnet-4-6',
    max_tokens: notesMsgs.maxTokens,
    system: notesMsgs.system,
    messages: notesMsgs.messages,
  })
  const extracted = parseJson(notesRes.content[0]?.text ?? '')
  const candidateName = extracted?.candidate_name
  const candidateEmail = extracted?.candidate_email

  if (!candidateName && !candidateEmail) {
    return {
      classification: classification.type,
      label: classification.label,
      action: 'ask',
      question: "Who are these notes about? I couldn't find a name.",
    }
  }

  const matchResult = await matchCandidateWithConfidence(
    { name: candidateName, email: candidateEmail },
    recruiter.id,
    supabase,
    convContext.candidateIds || new Set()
  )

  if (matchResult.action === 'ask') {
    return {
      classification: classification.type,
      label: classification.label,
      action: 'ask',
      alternatives: matchResult.alternatives,
      extracted_name: candidateName,
    }
  }

  // No match for notes → ask (don't auto-create from notes alone)
  if (matchResult.action === 'create') {
    return {
      classification: classification.type,
      label: classification.label,
      action: 'ask',
      question: `I don't have ${candidateName || 'this candidate'} in your book yet. Who are these notes about, or should I create a new record?`,
    }
  }

  return persistNotesToCandidate(text, extracted, matchResult.match, classification, recruiter)
}

async function persistNotesToCandidate(rawText, extracted, candidate, classification, recruiter) {
  const callLog = extracted?.call_log || {}
  const signals = extracted?.signals || {}

  const interactionBody = callLog.raw_transcript || callLog.summary || rawText.slice(0, 5000)
  const { data: interaction, error: intErr } = await supabase
    .from('interactions')
    .insert({
      recruiter_id: recruiter.id,
      candidate_id: candidate.id,
      type: 'call',
      subject: callLog.summary ? callLog.summary.slice(0, 100) : 'Call notes',
      body: interactionBody,
      occurred_at: new Date().toISOString(),
    })
    .select('id').single()

  if (intErr) return { error: intErr.message }

  // Write signals to career_signals (canonical location the card reads)
  const newSignals = {}
  if (signals.motivation)         newSignals.motivation = signals.motivation
  if (signals.comp_expectations)  newSignals.comp_expectations = signals.comp_expectations
  if (signals.timeline)           newSignals.timeline = signals.timeline
  if (signals.status_change)      newSignals.status_change = signals.status_change
  if (signals.red_flags?.length)  newSignals.red_flags = signals.red_flags

  if (Object.keys(newSignals).length > 0) {
    const { data: current } = await supabase
      .from('candidates').select('career_signals').eq('id', candidate.id).single()
    await supabase.from('candidates').update({
      career_signals: { ...(current?.career_signals || {}), ...newSignals },
    }).eq('id', candidate.id)
  }

  const name = `${candidate.first_name} ${candidate.last_name}`
  const signalCount = Object.keys(newSignals).length
  return {
    classification: classification.type,
    label: classification.label,
    action: 'enriched',
    entity_type: 'candidate',
    candidate_id: candidate.id,
    name,
    interaction_id: interaction.id,
    signals_captured: signalCount,
    what_happened: signalCount > 0
      ? `Added call notes to ${name}'s record (${signalCount} signal${signalCount !== 1 ? 's' : ''} captured)`
      : `Added call notes to ${name}'s record`,
  }
}

// Shared role persistence: match-or-create company then role.
// Uses ilike for both; falls back to intake model's role_id if it matched an existing role.
async function persistRole(extracted, rawText, recruiter) {
  const r = extracted.role || {}

  // Match or create client (company) — ilike, case-insensitive
  let clientId
  const { data: existingClient } = await supabase
    .from('clients').select('id')
    .eq('recruiter_id', recruiter.id).ilike('name', r.company)
    .maybeSingle()

  if (existingClient) {
    clientId = existingClient.id
  } else {
    const { data, error } = await supabase
      .from('clients')
      .insert({ recruiter_id: recruiter.id, name: r.company, ...(r.location && { hq_location: r.location }) })
      .select('id').single()
    if (error) return { error: error.message }
    clientId = data.id
  }

  // Match or create role
  let roleId
  let roleAction

  if (r.role_id) {
    // Intake model matched semantically to an existing role
    roleId = r.role_id
    roleAction = 'matched'
  } else {
    const { data: existingRole } = await supabase
      .from('roles').select('id')
      .eq('recruiter_id', recruiter.id).eq('client_id', clientId).ilike('title', r.title)
      .maybeSingle()

    if (existingRole) {
      roleId = existingRole.id
      roleAction = 'reused'
    } else {
      const { data, error } = await supabase
        .from('roles')
        .insert({
          recruiter_id: recruiter.id,
          client_id: clientId,
          title: r.title,
          status: 'open',
          process_steps: ['Sourced', 'Screen', 'Hiring Manager', 'Final Round', 'Offer', 'Placed'],
          notes: rawText.slice(0, 20000), // store raw JD text
        })
        .select('id').single()
      if (error) return { error: error.message }
      roleId = data.id
      roleAction = 'created'
    }
  }

  return {
    action: roleAction,
    entity_type: 'role',
    role_id: roleId,
    client_id: clientId,
    role_title: r.title,
    company: r.company,
    what_happened: roleAction === 'created'
      ? `Created ${r.title} at ${r.company}`
      : roleAction === 'reused'
        ? `Found existing role: ${r.title} at ${r.company}`
        : `Matched to ${r.title} at ${r.company}`,
  }
}

async function toolAddToPipeline({ candidate_id, role_id }, recruiter) {
  const [{ data: candidate }, { data: role }] = await Promise.all([
    supabase.from('candidates')
      .select('id, first_name, last_name')
      .eq('id', candidate_id).eq('recruiter_id', recruiter.id).single(),
    supabase.from('roles')
      .select('id, title, clients(name)')
      .eq('id', role_id).eq('recruiter_id', recruiter.id).single(),
  ])
  if (!candidate) return { error: 'Candidate not found' }
  if (!role) return { error: 'Role not found' }

  const { data: existing } = await supabase
    .from('pipelines').select('id, current_stage')
    .eq('candidate_id', candidate_id).eq('role_id', role_id)
    .eq('recruiter_id', recruiter.id).maybeSingle()

  const candidateName = `${candidate.first_name} ${candidate.last_name}`
  const roleTitle = role.title
  const company = role.clients?.name

  if (existing) {
    return { action: 'already_exists', candidate_name: candidateName, role_title: roleTitle, company, stage: existing.current_stage }
  }

  const { data: newPipeline, error } = await supabase.from('pipelines').insert({
    recruiter_id: recruiter.id,
    candidate_id,
    role_id,
    current_stage: 'submitted',
    status: 'active',
  }).select('id').single()
  if (error) return { error: error.message }

  await supabase.from('pipeline_stage_history').insert({
    pipeline_id:  newPipeline.id,
    recruiter_id: recruiter.id,
    stage:        'submitted',
    entered_at:   new Date().toISOString(),
  })

  return { action: 'created', candidate_name: candidateName, role_title: roleTitle, company, stage: 'submitted' }
}

async function toolMoveStage(
  { pipeline_id, candidate_id, role_id, target_stage, backward_reason, lost_reason, start_date, guarantee_days, notes },
  recruiter
) {
  // Resolve pipeline row
  let pipeline
  if (pipeline_id) {
    const { data } = await supabase
      .from('pipelines')
      .select('id, current_stage, candidates(first_name, last_name), roles(title, clients(name))')
      .eq('id', pipeline_id).eq('recruiter_id', recruiter.id).maybeSingle()
    pipeline = data
  } else if (candidate_id && role_id) {
    const { data } = await supabase
      .from('pipelines')
      .select('id, current_stage, candidates(first_name, last_name), roles(title, clients(name))')
      .eq('candidate_id', candidate_id).eq('role_id', role_id).eq('recruiter_id', recruiter.id).maybeSingle()
    pipeline = data
  } else {
    return { error: 'Provide pipeline_id or both candidate_id and role_id.' }
  }

  if (!pipeline) return { error: 'No pipeline entry found. Submit them first with add_to_pipeline.' }

  const { id: pid, current_stage } = pipeline
  const candidateName = [pipeline.candidates?.first_name, pipeline.candidates?.last_name].filter(Boolean).join(' ')
  const roleTitle = pipeline.roles?.title
  const company  = pipeline.roles?.clients?.name

  if (!STAGES.includes(target_stage)) {
    return { error: `Unknown stage: ${target_stage}. Valid stages: ${STAGES.join(', ')}.` }
  }

  if (current_stage === target_stage) return { error: `Already at ${target_stage}.` }

  const moveType = classifyMove(current_stage, target_stage)

  if (moveType === 'backward' && !backward_reason) {
    return { error: 'Backward move needs a reason (client_added_step, candidate_bumped, correction, or other) — ask first.' }
  }
  if (target_stage === 'lost' && !lost_reason) {
    return { error: 'Moving to lost needs a reason — ask first.' }
  }

  const now = new Date().toISOString()

  // Correction path: attempt clean undo, fall back to append if unsafe
  if (backward_reason === 'correction') {
    if (moveType === 'terminal') {
      return { error: 'A correction cannot target a terminal stage. Use a non-correction backward_reason for placed/lost.' }
    }
    const { data: histRows } = await supabase
      .from('pipeline_stage_history')
      .select('id, stage, entered_at, exited_at')
      .eq('pipeline_id', pid)
      .order('entered_at', { ascending: false })
      .limit(2)

    const openRow  = histRows?.[0]
    const priorRow = histRows?.[1]

    let hasAttached = false
    if (openRow?.entered_at) {
      const [{ count: intCount }, { count: debCount }] = await Promise.all([
        supabase.from('interactions').select('id', { count: 'exact', head: true })
          .eq('pipeline_id', pid).gte('created_at', openRow.entered_at),
        supabase.from('debriefs').select('id', { count: 'exact', head: true })
          .eq('pipeline_id', pid).gte('created_at', openRow.entered_at),
      ])
      hasAttached = (intCount ?? 0) > 0 || (debCount ?? 0) > 0
    }

    if (priorRow && !hasAttached) {
      // Clean destructive undo
      await supabase.from('pipeline_stage_history').delete().eq('id', openRow.id)
      await supabase.from('pipeline_stage_history').update({ exited_at: null }).eq('id', priorRow.id)
      await supabase.from('pipelines').update({ current_stage: priorRow.stage, updated_at: now }).eq('id', pid)
      return {
        action: 'corrected',
        candidate_name: candidateName, role_title: roleTitle, company,
        old_stage: current_stage, new_stage: priorRow.stage,
        history_note: 'Erroneous move removed from history.',
      }
    }
    // Dirty path: fall through — append correction row
  }

  // Close the current open history row
  await supabase.from('pipeline_stage_history')
    .update({ exited_at: now })
    .eq('pipeline_id', pid).is('exited_at', null)

  // Open a new history row for the target stage
  await supabase.from('pipeline_stage_history').insert({
    pipeline_id:  pid,
    recruiter_id: recruiter.id,
    stage:        target_stage,
    entered_at:   now,
    ...(backward_reason ? { stage_change_reason: backward_reason } : {}),
    ...(notes           ? { notes }                                 : {}),
  })

  // Update the pipeline row
  const pipelineUpdate = { current_stage: target_stage, updated_at: now }

  if (moveType === 'terminal') {
    pipelineUpdate.stage_reached = current_stage
    if (target_stage === 'lost') pipelineUpdate.lost_reason = lost_reason ?? null
    if (target_stage === 'placed') {
      pipelineUpdate.start_date = start_date ?? null
      if (guarantee_days != null) pipelineUpdate.guarantee_days = guarantee_days
    }
  }

  if (moveType === 'reopen') {
    pipelineUpdate.stage_reached = null
    pipelineUpdate.lost_reason   = null
    pipelineUpdate.start_date    = null
  }

  await supabase.from('pipelines').update(pipelineUpdate).eq('id', pid)

  return {
    action:         'moved',
    candidate_name: candidateName,
    role_title:     roleTitle,
    company,
    old_stage:      current_stage,
    new_stage:      target_stage,
    move_type:      moveType,
    ...(lost_reason     ? { lost_reason }     : {}),
    ...(start_date      ? { start_date }      : {}),
    ...(backward_reason ? { backward_reason } : {}),
  }
}

async function toolCreateRole({ title, company, location, notes }, recruiter) {
  if (!title?.trim() || !company?.trim()) return { error: 'title and company are required' }

  let clientId
  const { data: existingClient } = await supabase
    .from('clients').select('id')
    .eq('recruiter_id', recruiter.id).ilike('name', company.trim())
    .maybeSingle()

  if (existingClient) {
    clientId = existingClient.id
  } else {
    const { data, error } = await supabase
      .from('clients')
      .insert({ recruiter_id: recruiter.id, name: company.trim(), ...(location && { hq_location: location }) })
      .select('id').single()
    if (error) return { error: error.message }
    clientId = data.id
  }

  const { data: existingRole } = await supabase
    .from('roles').select('id')
    .eq('recruiter_id', recruiter.id).eq('client_id', clientId).ilike('title', title.trim())
    .maybeSingle()

  if (existingRole) {
    return {
      action: 'already_exists',
      entity_type: 'role',
      role_id: existingRole.id,
      role_title: title.trim(),
      company: company.trim(),
      what_happened: `${title} at ${company} already exists`,
    }
  }

  const { data, error } = await supabase
    .from('roles')
    .insert({
      recruiter_id: recruiter.id,
      client_id: clientId,
      title: title.trim(),
      status: 'open',
      process_steps: ['Sourced', 'Screen', 'Hiring Manager', 'Final Round', 'Offer', 'Placed'],
      ...(notes && { notes: notes.slice(0, 20000) }),
    })
    .select('id').single()
  if (error) return { error: error.message }

  return {
    action: 'created',
    entity_type: 'role',
    role_id: data.id,
    client_id: clientId,
    role_title: title.trim(),
    company: company.trim(),
    what_happened: `Created ${title} at ${company}`,
  }
}

async function toolCreateCandidate({ name, email, current_title, current_company, cv_text }, recruiter) {
  if (!name?.trim()) return { error: 'name is required' }
  const { first_name, last_name } = parseName(name)

  const { data, error } = await supabase
    .from('candidates')
    .insert({
      recruiter_id: recruiter.id,
      first_name,
      last_name,
      ...(email           && { email }),
      ...(current_title   && { current_title }),
      ...(current_company && { current_company }),
      ...(cv_text         && { cv_text }),
    })
    .select('id').single()
  if (error) return { error: error.message }

  const fullName = `${first_name} ${last_name}`.trim()
  return {
    action: 'created',
    entity_type: 'candidate',
    candidate_id: data.id,
    name: fullName,
    what_happened: `Created candidate record for ${fullName}`,
  }
}

async function toolEnrichFromNotes({ notes_text, candidate_id }, recruiter, convContext = {}) {
  if (!notes_text?.trim()) return { error: 'No notes provided' }

  // Targeted extraction first
  const notesMsgs = buildNotesExtractionMessages(notes_text)
  const notesRes = await anthropic.messages.create({
    model: process.env.AI_MODEL || 'claude-sonnet-4-6',
    max_tokens: notesMsgs.maxTokens,
    system: notesMsgs.system,
    messages: notesMsgs.messages,
  })
  const extracted = parseJson(notesRes.content[0]?.text ?? '')

  let candidate

  if (candidate_id) {
    const { data } = await supabase
      .from('candidates')
      .select('id, first_name, last_name, enrichment_data')
      .eq('id', candidate_id).eq('recruiter_id', recruiter.id)
      .single()
    if (!data) return { error: 'Candidate not found' }
    candidate = data
  } else {
    const candidateName = extracted?.candidate_name
    const candidateEmail = extracted?.candidate_email

    if (!candidateName && !candidateEmail) {
      return { action: 'ask', question: "Who are these notes about? I couldn't find a name." }
    }

    const matchResult = await matchCandidateWithConfidence(
      { name: candidateName, email: candidateEmail },
      recruiter.id,
      supabase,
      convContext.candidateIds || new Set()
    )

    if (matchResult.action !== 'act') {
      return {
        action: 'ask',
        alternatives: matchResult.alternatives,
        extracted_name: candidateName,
      }
    }
    candidate = matchResult.match
  }

  const classification = { type: 'notes', label: 'Call notes' }
  return persistNotesToCandidate(notes_text, extracted, candidate, classification, recruiter)
}
