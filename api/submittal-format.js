import { createClient } from '@supabase/supabase-js'
import { buildSubmittalDraftPayload } from './_lib/buildSubmittalDraft.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

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

  const { candidate_id, role_id, format, resolved_flags = '' } = req.body
  if (!candidate_id || !role_id || !format) {
    return res.status(400).json({ error: 'candidate_id, role_id, and format are required' })
  }

  const result = await buildSubmittalDraftPayload(
    { role_id, candidate_id, mode: 'external', format, resolved_flags },
    recruiter
  )

  if (result.error) return res.status(400).json(result)
  return res.status(200).json({ draft_text: result.draft_text, format: result.format })
}
