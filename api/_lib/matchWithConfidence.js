// Confidence-gated candidate matching. One function, used everywhere:
// toolIngestInput, toolEnrichFromNotes, and toolSearchDb salience ranking.
//
// Returns { confidence, match, alternatives, action, salience_label }
//   action 'act'    — confidence ≥ 90 with clear winner (>12 pt gap), use match
//   action 'ask'    — below threshold or two comparably-salient records
//   action 'create' — no match (valid for resume/JD; notes callers should 'ask' instead)
//
// Confidence base from match strength:
//   Exact email, single result        → 98 (act immediately)
//   Case-insensitive name, 1 result   → 85 base + salience
//   Case-insensitive name, N results  → 85 base + salience each, ranked
//   No match                          → 0
//
// Salience boosts (additive, cap at 98). Drivers ranked by reliability:
//   Mentioned in current conversation → +12  (strongest: recruiter just named them)
//   Active pipeline                   → +10  (in a deal right now)
//   Pipeline updated in last 30 days  → +6   (recent stage advance or update)
//   Interaction in last 30 days       → +6   (recently worked)
//   Created in last 30 days           → +4   (brand-new record)
//   Interaction in last 90 days       → +2   (not dormant)
//   Submitted (submitted_at not null) → +1   (minor; rarely set — manual submittals skip Gmail)
//
// DB queries are batched: 2 queries for N candidates, not 3N.

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000
const ACT_THRESHOLD = 90
const ACT_GAP = 12 // runner-up must be ≥ 12 pts below top to act without asking

export async function matchCandidateWithConfidence(
  { name, email },
  recruiterId,
  supabase,
  conversationCandidateIds = new Set()
) {
  if (!name && !email) {
    return { confidence: 0, match: null, alternatives: null, action: 'ask' }
  }

  // ── Find candidates ──────────────────────────────────────────────────────────

  let candidates = []

  if (email) {
    const { data } = await supabase
      .from('candidates')
      .select('id, first_name, last_name, current_title, current_company, created_at, email')
      .eq('recruiter_id', recruiterId)
      .ilike('email', email.trim())
      .limit(3)
    candidates = data || []

    if (candidates.length === 1) {
      return {
        confidence: 98,
        match: candidates[0],
        alternatives: null,
        action: 'act',
        salience_label: `${candidates[0].first_name} ${candidates[0].last_name} (email match)`,
      }
    }
  }

  if (!candidates.length && name) {
    const parts = name.trim().split(/\s+/).filter(Boolean)

    if (parts.length >= 2) {
      const first = parts[0]
      const last = parts.slice(1).join(' ')
      const [fwd, rev] = await Promise.all([
        supabase
          .from('candidates')
          .select('id, first_name, last_name, current_title, current_company, created_at, email')
          .eq('recruiter_id', recruiterId)
          .ilike('first_name', `%${first}%`)
          .ilike('last_name', `%${last}%`)
          .limit(10),
        supabase
          .from('candidates')
          .select('id, first_name, last_name, current_title, current_company, created_at, email')
          .eq('recruiter_id', recruiterId)
          .ilike('first_name', `%${last}%`)
          .ilike('last_name', `%${first}%`)
          .limit(10),
      ])
      const combined = [...(fwd.data || []), ...(rev.data || [])]
      candidates = combined.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i)
    } else {
      const { data } = await supabase
        .from('candidates')
        .select('id, first_name, last_name, current_title, current_company, created_at, email')
        .eq('recruiter_id', recruiterId)
        .or(`first_name.ilike.%${parts[0]}%,last_name.ilike.%${parts[0]}%`)
        .limit(10)
      candidates = data || []
    }
  }

  if (!candidates.length) {
    return { confidence: 0, match: null, alternatives: null, action: 'create' }
  }

  // ── Batch salience queries (2 queries, not 3N) ───────────────────────────────

  const candidateIds = candidates.map(c => c.id)
  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS).toISOString()
  const ninetyDaysAgo = new Date(Date.now() - NINETY_DAYS_MS).toISOString()

  const [pipelineRes, interactionsRes] = await Promise.all([
    supabase
      .from('pipeline')
      .select('candidate_id, current_stage, status, updated_at, submitted_at')
      .in('candidate_id', candidateIds)
      .eq('recruiter_id', recruiterId)
      .not('current_stage', 'in', '(placed,lost)')
      .eq('status', 'active'),
    supabase
      .from('interactions')
      .select('candidate_id, occurred_at')
      .in('candidate_id', candidateIds)
      .eq('recruiter_id', recruiterId)
      .gte('occurred_at', ninetyDaysAgo)
      .order('occurred_at', { ascending: false }),
  ])

  const pipelineByCandidate = {}
  for (const p of pipelineRes.data || []) {
    if (!pipelineByCandidate[p.candidate_id]) pipelineByCandidate[p.candidate_id] = p
  }

  const lastInteractionByCandidate = {}
  for (const i of interactionsRes.data || []) {
    if (!lastInteractionByCandidate[i.candidate_id]) {
      lastInteractionByCandidate[i.candidate_id] = i.occurred_at
    }
  }

  // ── Score each candidate ─────────────────────────────────────────────────────

  const now = new Date()

  const scored = candidates.map(c => {
    let score = 85

    // Conversation context: recruiter just named or worked this person
    if (conversationCandidateIds.has(c.id)) score += 12

    const pipeline = pipelineByCandidate[c.id]
    if (pipeline) {
      score += 10 // active in a deal
      // Pipeline recently touched (stage advance or update)
      if (pipeline.updated_at && (now - new Date(pipeline.updated_at)) <= THIRTY_DAYS_MS) {
        score += 6
      }
      // submitted_at: minor bonus — manual (Paraform) submittals don't set this
      if (pipeline.submitted_at) score += 1
    }

    const lastInteraction = lastInteractionByCandidate[c.id]
    if (lastInteraction) {
      const age = now - new Date(lastInteraction)
      if (age <= THIRTY_DAYS_MS) score += 6
      else score += 2 // 30–90 day window
    }

    // Created recently
    if (c.created_at && (now - new Date(c.created_at)) <= THIRTY_DAYS_MS) score += 4

    return { candidate: c, score, pipeline: pipeline || null }
  })

  scored.sort((a, b) => b.score - a.score)

  // ── Apply threshold ──────────────────────────────────────────────────────────

  const top = scored[0]
  const runnerUp = scored[1]

  const clearWinner = top.score >= ACT_THRESHOLD && (!runnerUp || top.score - runnerUp.score > ACT_GAP)

  if (clearWinner) {
    return {
      confidence: top.score,
      match: top.candidate,
      alternatives: null,
      action: 'act',
      salience_label: buildSalienceLabel(top),
    }
  }

  return {
    confidence: top.score,
    match: null,
    alternatives: scored.map(s => ({
      candidate: s.candidate,
      confidence: s.score,
      salience_label: buildSalienceLabel(s),
    })),
    action: 'ask',
  }
}

function buildSalienceLabel({ candidate, score, pipeline }) {
  const name = `${candidate.first_name} ${candidate.last_name}`
  if (pipeline) {
    return `${name} (active pipeline · ${pipeline.current_stage})`
  }
  if (score >= 91) return `${name} (recent activity)`
  const meta = [candidate.current_title, candidate.current_company].filter(Boolean).join(' at ')
  return meta ? `${name} · ${meta}` : name
}

// Extract candidate IDs mentioned in prior conversation tool results.
// Used to prime conversationCandidateIds for salience scoring.
export function extractConversationCandidateIds(history) {
  const ids = new Set()
  for (const row of history || []) {
    if (row.content?.type !== 'turn_steps') continue
    for (const step of row.content.steps || []) {
      if (step.type !== 'tool_step') continue
      for (const result of step.user || []) {
        try {
          const data = JSON.parse(result.content || '{}')
          if (data.candidate_id) ids.add(data.candidate_id)
          // get_candidate returns the candidate record directly at top level
          if (data.id && data.first_name) ids.add(data.id)
          // search_db results array
          if (Array.isArray(data.results)) {
            for (const r of data.results) {
              if (r.id && r.first_name) ids.add(r.id)
            }
          }
        } catch {}
      }
    }
  }
  return ids
}
