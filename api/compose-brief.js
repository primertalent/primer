import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { composeBrief } from './_lib/composeBrief.js'

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

  const { conversation_id } = req.body || {}
  if (!conversation_id) return res.status(400).json({ error: 'conversation_id required' })

  const { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversation_id)
    .eq('recruiter_id', recruiter.id)
    .maybeSingle()

  if (!conv) return res.status(403).json({ error: 'Conversation not found' })

  try {
    const { message_id, text, already_composed } = await composeBrief(supabase, anthropic, {
      recruiter,
      conversationId: conversation_id,
    })
    return res.json({ message_id, text, already_composed })
  } catch (err) {
    console.error('[compose-brief] error:', err.message)
    return res.status(500).json({ error: 'Failed to compose brief' })
  }
}
