import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { buildWrenAgentSystem } from '../src/lib/prompts/wrenAgent.js'
import { buildScreenerMessages } from '../src/lib/prompts/resumeScreener.js'
import { buildSubmissionMessages } from '../src/lib/prompts/submissionDraft.js'
import { buildOutreachEmailMessages } from '../src/lib/prompts/candidateOutreachEmail.js'

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: recruiter, error: rErr } = await supabase
    .from('recruiters')
    .select('id, full_name, email')
    .eq('user_id', user.id)
    .single()
  if (rErr || !recruiter) return res.status(401).json({ error: 'No recruiter profile' })

  const { conversation_id, message } = req.body
  if (!message?.trim()) return res.status(400).json({ error: 'message required' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

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

    // Load all messages — no truncation so draft threads never lose context (Q7)
    const { data: history } = await supabase
      .from('conversation_messages')
      .select('role, content, created_at')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })

    const apiMessages = buildApiMessages(history || [])
    const system = buildWrenAgentSystem(recruiter)
    const tools = getToolDefinitions()

    const { fullText, renders } = await runAgentLoop(apiMessages, system, tools, recruiter, res)

    const { data: savedMsg } = await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: convId,
        recruiter_id: recruiter.id,
        role: 'assistant',
        content: { type: 'message', text: fullText, renders },
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

// Reconstruct Anthropic messages array from history.
// Only the text content is forwarded — renders and tool blocks are stripped.
// The model's text narration carries context for multi-turn continuity.
// Consecutive same-role messages are merged (handles error recovery gaps).
function buildApiMessages(history) {
  const msgs = []
  for (const row of history) {
    const text = row.content?.text || ''
    if (!text || row.role === 'tool') continue
    if (row.role === 'user' || row.role === 'assistant') {
      msgs.push({ role: row.role, content: text })
    }
  }
  const deduped = []
  for (const m of msgs) {
    if (deduped.length && deduped[deduped.length - 1].role === m.role) {
      deduped[deduped.length - 1].content += '\n' + m.content
    } else {
      deduped.push({ ...m })
    }
  }
  return deduped
}

async function runAgentLoop(initialMessages, system, tools, recruiter, res) {
  const messages = [...initialMessages]
  const renders = []
  let fullText = ''

  while (true) {
    const stream = anthropic.messages.stream({
      model: process.env.AI_MODEL || 'claude-sonnet-4-6',
      max_tokens: 4000,
      system,
      messages,
      tools,
    })

    stream.on('text', (chunk) => {
      fullText += chunk
      sse(res, 'text', { text: chunk })
    })

    const finalMsg = await stream.finalMessage()

    if (finalMsg.stop_reason === 'end_turn') break

    if (finalMsg.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: finalMsg.content })
      const toolResults = []

      for (const block of finalMsg.content) {
        if (block.type !== 'tool_use') continue
        sse(res, 'tool_call', { name: block.name })
        const result = await executeTool(block.name, block.input, recruiter)
        renders.push({ tool: block.name, data: result })
        sse(res, 'tool_result', { tool: block.name, data: result })
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        })
      }

      messages.push({ role: 'user', content: toolResults })
    } else {
      // Unexpected stop reason — exit to avoid infinite loop
      break
    }
  }

  return { fullText, renders }
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

function getToolDefinitions() {
  return [
    {
      name: 'search_db',
      description: "Search the recruiter's database for candidates or roles by name, company, or keyword. Use this to resolve a name to an ID before calling get_candidate or get_role.",
      input_schema: {
        type: 'object',
        properties: {
          entity_type: { type: 'string', enum: ['candidate', 'role'] },
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
      description: 'Retrieve a full role record: JD, process steps, comp range, and client objection history from recent debriefs across all candidates at this client. Always call this before screen_candidate.',
      input_schema: {
        type: 'object',
        properties: {
          role_id: { type: 'string' },
        },
        required: ['role_id'],
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
      description: 'Draft a candidate submittal for a role. Always include the complete draft in your response. For revisions, pass prior_draft (full text from conversation history) and revision_instruction.',
      input_schema: {
        type: 'object',
        properties: {
          role_id: { type: 'string' },
          candidate_id: { type: 'string', description: 'If candidate is in the system.' },
          resume_text: { type: 'string', description: 'Raw resume text if candidate is not in the system.' },
          format: { type: 'string', enum: ['bullet', 'email'], description: 'Default: bullet.' },
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
  ]
}

// ─── Tool execution ───────────────────────────────────────────────────────────

async function executeTool(name, input, recruiter) {
  switch (name) {
    case 'search_db':        return toolSearchDb(input, recruiter)
    case 'get_candidate':    return toolGetCandidate(input, recruiter)
    case 'get_role':         return toolGetRole(input, recruiter)
    case 'screen_candidate': return toolScreenCandidate(input, recruiter)
    case 'draft_submittal':  return toolDraftSubmittal(input, recruiter)
    case 'draft_outreach':   return toolDraftOutreach(input, recruiter)
    default:                 return { error: `Unknown tool: ${name}` }
  }
}

async function toolSearchDb({ entity_type, query }, recruiter) {
  if (entity_type === 'candidate') {
    const { data } = await supabase
      .from('candidates')
      .select('id, first_name, last_name, current_title, current_company')
      .eq('recruiter_id', recruiter.id)
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,current_company.ilike.%${query}%`)
      .limit(5)
    return { results: data || [] }
  }
  if (entity_type === 'role') {
    const { data: byTitle } = await supabase
      .from('roles')
      .select('id, title, status, clients(name)')
      .eq('recruiter_id', recruiter.id)
      .eq('status', 'open')
      .ilike('title', `%${query}%`)
      .limit(5)
    const { data: byClient } = await supabase
      .from('roles')
      .select('id, title, status, clients!inner(name)')
      .eq('recruiter_id', recruiter.id)
      .eq('status', 'open')
      .ilike('clients.name', `%${query}%`)
      .limit(5)
    const combined = [...(byTitle || []), ...(byClient || [])]
    const unique = combined.filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i)
    return { results: unique }
  }
  return { results: [] }
}

async function toolGetCandidate({ candidate_id }, recruiter) {
  const { data: candidate, error } = await supabase
    .from('candidates')
    .select('id, first_name, last_name, current_title, current_company, location, email, phone, skills, cv_text, career_timeline, notes, career_signals')
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
    .from('pipeline')
    .select('id, current_stage, fit_score, expected_comp, roles(id, title, clients(name))')
    .eq('candidate_id', candidate_id)
    .eq('recruiter_id', recruiter.id)
    .not('current_stage', 'in', '(placed,lost)')

  return { ...candidate, recent_interactions: interactions || [], active_pipelines: pipelines || [] }
}

async function toolGetRole({ role_id }, recruiter) {
  const { data: role, error } = await supabase
    .from('roles')
    .select('id, title, status, notes, process_steps, comp_min, comp_max, comp_type, target_comp_min, target_comp_max, clients(id, name, industry, notes)')
    .eq('id', role_id)
    .eq('recruiter_id', recruiter.id)
    .single()
  if (error || !role) return { error: 'Role not found' }

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
        .from('pipeline')
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

  return { ...role, client_history: clientHistory }
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
  const aiRes = await anthropic.messages.create({
    model: process.env.AI_MODEL || 'claude-sonnet-4-6',
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

  return {
    ...result,
    from_paste: !!candidateData._from_paste,
    role_title: roleData.title,
    client_name: roleData.clients?.name,
  }
}

async function toolDraftSubmittal({ role_id, candidate_id, resume_text, format = 'bullet', prior_draft, revision_instruction }, recruiter) {
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

  const { data: voiceSamples } = await supabase
    .from('voice_samples')
    .select('channel, subject, body')
    .eq('recruiter_id', recruiter.id)
    .in('channel', ['email', 'linkedin'])
    .limit(3)

  let messages
  if (revision_instruction && prior_draft) {
    messages = buildRevisionMessages(prior_draft, revision_instruction)
  } else {
    const fitScore = candidateData.active_pipelines?.find(p => p.roles?.id === role_id)?.fit_score ?? null
    messages = buildSubmissionMessages(candidateData, roleData, fitScore, format, voiceSamples || [])
  }

  const aiRes = await anthropic.messages.create({
    model: process.env.AI_MODEL || 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages,
  })

  const draft_text = aiRes.content[0]?.text ?? ''
  return {
    draft_text,
    format,
    from_paste: !!candidateData._from_paste,
    candidate_name: candidateData._from_paste
      ? null
      : `${candidateData.first_name} ${candidateData.last_name}`,
    role_title: roleData.title,
    client_name: roleData.clients?.name,
    is_revision: !!(revision_instruction && prior_draft),
  }
}

function buildRevisionMessages(priorDraft, instruction) {
  return [{
    role: 'user',
    content: `You are revising a candidate submission draft per a recruiter's instruction.

ORIGINAL DRAFT:
${priorDraft}

REVISION INSTRUCTION:
${instruction}

Apply the instruction. Return only the revised draft — no intro, no "here's the revision:", just the draft. Preserve everything not mentioned in the instruction. Same format (bullet or paragraph). Same writing rules: no em dashes, no AI filler, recruiter voice, short sentences.`,
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

  const messages = buildOutreachEmailMessages(candidateData, roleData)
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
