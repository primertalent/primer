import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { runLoopForRecruiter } from './_lib/agent-loop-runner.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Note: Vercel Hobby has a 10-second function timeout. maxDuration only takes effect on Pro.
export const config = {
  maxDuration: 60,
}

export default async function handler(req, res) {
  const auth = req.headers['authorization']
  if (!auth || auth !== `Bearer ${process.env.AGENT_LOOP_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const sourceRunId = crypto.randomUUID()

    // If recruiter_id is provided (e.g. triggered by ingest-email), run for that
    // recruiter only. Otherwise scan all recruiters with active pipelines (cron path).
    const scopedId = req.query?.recruiter_id || req.body?.recruiter_id || null

    let recruiterIds
    if (scopedId) {
      recruiterIds = [scopedId]
    } else {
      const { data: pipelineRows, error: prErr } = await supabase
        .from('pipeline')
        .select('recruiter_id')
        .not('current_stage', 'in', '(placed,lost)')
      if (prErr) throw prErr
      recruiterIds = [...new Set((pipelineRows || []).map(r => r.recruiter_id))]
    }

    const summary = []
    for (const recruiterId of recruiterIds) {
      const result = await runLoopForRecruiter(recruiterId, sourceRunId)
      summary.push(result)
    }

    return res.status(200).json({ ok: true, source_run_id: sourceRunId, recruiters: summary })
  } catch (err) {
    console.error('[agent-loop] error:', err)
    return res.status(500).json({ error: err.message })
  }
}
