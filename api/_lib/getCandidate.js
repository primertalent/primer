/**
 * Shared candidate fetch — canonical data shape for CandidateCard.
 * Used by both the wren agent tool (get_candidate) and composeBrief (in-flight cards).
 * Single source so brief cards and entity-pull cards can't drift.
 */
export async function getCandidate(supabase, candidate_id, recruiter_id) {
  const { data: candidate, error } = await supabase
    .from('candidates')
    .select('id, first_name, last_name, current_title, current_company, location, email, phone, skills, cv_text, career_timeline, notes, career_signals, enrichment_data')
    .eq('id', candidate_id)
    .eq('recruiter_id', recruiter_id)
    .single()
  if (error || !candidate) return { error: 'Candidate not found' }

  const { data: interactions } = await supabase
    .from('interactions')
    .select('type, direction, body, occurred_at')
    .eq('candidate_id', candidate_id)
    .eq('recruiter_id', recruiter_id)
    .order('occurred_at', { ascending: false })
    .limit(5)

  const { data: pipelines } = await supabase
    .from('pipelines')
    .select('id, current_stage, fit_score, expected_comp, roles(id, title, clients(name))')
    .eq('candidate_id', candidate_id)
    .eq('recruiter_id', recruiter_id)
    .not('current_stage', 'in', '(placed,lost)')

  // Merge enrichment_data (old write path) into career_signals (canonical).
  // enrichment_data fills gaps; career_signals wins per key.
  const resolvedSignals = {
    ...(candidate.enrichment_data || {}),
    ...(candidate.career_signals   || {}),
  }
  const { enrichment_data: _ed, ...candidateRest } = candidate
  return {
    ...candidateRest,
    career_signals:       resolvedSignals,
    recent_interactions:  interactions || [],
    active_pipelines:     pipelines    || [],
  }
}
