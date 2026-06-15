export default function CandidateCard({ data }) {
  if (!data || data.error) return null

  const signals = typeof data.career_signals === 'string'
    ? (() => { try { return JSON.parse(data.career_signals) } catch { return {} } })()
    : (data.career_signals ?? {})

  const pipelines = (data.active_pipelines || []).slice(0, 5)
  const overflow = Math.max(0, (data.active_pipelines || []).length - 5)

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
    </div>
  )
}
