export default function ScreenResult({ data }) {
  if (!data || data.error) return null

  const score = data.match_score ?? 0
  const scoreColor = score >= 7 ? 'var(--win)' : score >= 4 ? 'var(--ink)' : 'var(--accent)'
  const recColor = {
    advance: 'var(--signal-green)',
    hold:    'var(--signal-amber)',
    pass:    'var(--signal-red)',
  }[data.recommendation] ?? 'var(--mute)'

  return (
    <div className="screen-result">
      <div className="screen-result__header">
        <span className="screen-result__score" style={{ color: scoreColor }}>
          {score}/10
        </span>
        <span className="screen-result__rec" style={{ color: recColor }}>
          {(data.recommendation ?? 'unknown').toUpperCase()}
        </span>
        {data.client_name && (
          <span className="screen-result__role">
            {data.role_title} — {data.client_name}
          </span>
        )}
      </div>

      {data.recommendation_reason && (
        <p className="screen-result__reason">{data.recommendation_reason}</p>
      )}

      <div className="screen-result__columns">
        {data.top_strengths?.length > 0 && (
          <div className="screen-result__col">
            <div className="screen-result__col-label">STRENGTHS</div>
            {data.top_strengths.map((s, i) => (
              <div key={i} className="screen-result__item screen-result__item--pos">{s}</div>
            ))}
          </div>
        )}
        {data.top_concerns?.length > 0 && (
          <div className="screen-result__col">
            <div className="screen-result__col-label">CONCERNS</div>
            {data.top_concerns.map((c, i) => (
              <div key={i} className="screen-result__item screen-result__item--neg">{c}</div>
            ))}
          </div>
        )}
      </div>

      {data.red_flags?.length > 0 && (
        <div className="screen-result__flags">
          <div className="screen-result__col-label">RED FLAGS</div>
          {data.red_flags.map((f, i) => (
            <div key={i} className="screen-result__item screen-result__item--flag">{f}</div>
          ))}
        </div>
      )}
    </div>
  )
}
