import { createClient } from '@supabase/supabase-js'
import { extractResumeText } from './_lib/extractFile.js'

// Body limit raised to 7 MB to accommodate base64 overhead on 5 MB files (~1.37×).
export const config = { api: { bodyParser: { sizeLimit: '7mb' } } }

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

  const { filename, content_base64 } = req.body || {}
  if (!filename || !content_base64) {
    return res.status(400).json({ error: 'filename and content_base64 are required' })
  }

  try {
    const text = await extractResumeText(filename, content_base64)
    return res.status(200).json({ text })
  } catch (err) {
    console.error('[extract-file]', err.message)
    const status  = err.statusCode || 500
    const message = err.statusCode
      ? err.message
      : 'Extraction failed — try again or paste the resume text directly'
    return res.status(status).json({ error: message })
  }
}
