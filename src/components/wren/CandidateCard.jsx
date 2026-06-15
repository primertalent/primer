function fmtDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear()
    ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function CandidateCard({ data }) {
  if (!data || data.error) return null

  const signals = typeof data.career_signals === 'string'
    ? (() => { try { return JSON.parse(data.career_signals) } catch { return {} } })()
    : (data.career_signals ?? {})

  const timeline = (data.career_timeline || []).slice(0, 2)
  const pipelines = (data.active_pipelines || []).slice(0, 5)
  const overflow = Math.max(0, (data.active_pipelines || []).length - 5)
  const lastContact = data.recent_interactions?.[0]?.occurred_at

  return (
    <div className="candidate-card">
      <div className="candidate-card__label">CANDIDATE</div>
      <div className="candidate-card__name">{data.first_name} {data.last_name}</div>
      {(data.current_title || data.current_company) && (
        <div className="candidate-card__meta">
          {[data.current_title, data.current_company].filter(Boolean).join(' at ')}
        </div>
      )}
      {data.location && (
        <div className="candidate-card__location">{data.location}</div>
      )}

      {timeline.length > 0 && (
        <div className="candidate-card__section">
          <div className="candidate-card__section-label">Career</div>
          {timeline.map((e, i) => (
            <div key={i} className="candidate-card__timeline-row">
              <span className="candidate-card__timeline-role">
                {[e.title, e.company].filter(Boolean).join(' at ')}
              </span>
              {(e.start || e.end) && (
                <span className="candidate-card__timeline-dates">
                  {e.start ?? ''}{e.start && (e.end ?? 'Present') ? ' – ' : ''}{e.end ?? (e.start ? 'Present' : '')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {(signals.comp_expectations || signals.timeline || signals.motivation) && (
        <div className="candidate-card__section">
          <div className="candidate-card__section-label">Signals</div>
          <div className="candidate-card__chips">
            {signals.comp_expectations && (
              <span className="candidate-card__chip">
                <span className="candidate-card__chip-key">COMP</span>
                {signals.comp_expectations}
              </span>
            )}
            {signals.timeline && (
              <span className="candidate-card__chip">
                <span className="candidate-card__chip-key">NOTICE</span>
                {signals.timeline}
              </span>
            )}
            {signals.motivation && (
              <span className="candidate-card__chip">
                <span className="candidate-card__chip-key">WHY</span>
                {signals.motivation}
              </span>
            )}
          </div>
        </div>
      )}

      {pipelines.length > 0 && (
        <div className="candidate-card__section">
          <div className="candidate-card__section-label">Active pipelines</div>
          {pipelines.map((p, i) => (
            <div key={i} className="candidate-card__pipeline-row">
              <span className="candidate-card__pipeline-role">
                {p.roles?.title || 'Unknown role'}
                {p.roles?.clients?.name ? ` / ${p.roles.clients.name}` : ''}
              </span>
              <span className="candidate-card__pipeline-stage">
                {p.current_stage || 'active'}
              </span>
            </div>
          ))}
          {overflow > 0 && (
            <div className="candidate-card__pipeline-overflow">+{overflow} more</div>
          )}
        </div>
      )}

      {lastContact && (
        <div className="candidate-card__last-contact">
          Last contact: {fmtDate(lastContact)}
        </div>
      )}
    </div>
  )
}
