import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { composeBrief } from './_lib/composeBrief.js'
import { getOrCreateTodayConversation } from './_lib/getOrCreateTodayConversation.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: recruiter } = await supabase
    .from('recruiters')
    .select('id, full_name, timezone, created_at')
    .eq('user_id', user.id)
    .single()

  if (!recruiter) return res.status(401).json({ error: 'Unauthorized' })

  // Resolve today's conversation SERVER-side via the same helper the cron uses, so
  // the in-app brief and the 9am email always target one conversation per local day.
  // The app previously resolved/created this client-side with a browser-local day
  // boundary that diverged from the cron's resolver (see the 2026-07-14 diagnosis);
  // it now defers to whatever conversation_id this endpoint returns.
  let conversationId
  try {
    conversationId = await getOrCreateTodayConversation(supabase, recruiter)
  } catch (err) {
    console.error('[compose-brief] conversation resolve failed:', err.message)
    return res.status(500).json({ error: 'Failed to resolve conversation' })
  }

  try {
    const result = await composeBrief(supabase, anthropic, { recruiter, conversationId })
    return res.json({
      message_id:       result.message_id,
      text:             result.text,
      already_composed: result.already_composed,
      conversation_id:  result.conversation_id ?? conversationId,
    })
  } catch (err) {
    console.error('[compose-brief] error:', err.message)
    return res.status(500).json({ error: 'Failed to compose brief' })
  }
}
