function agreementColor(status) {
  if (status === 'signed') return 'var(--signal-green)'
  if (status === 'missing') return 'var(--signal-amber)'
  return 'var(--mute)'
}

export default function CompanyCard({ data }) {
  if (!data || data.error) return null

  const meta = [data.industry, data.hq_location].filter(Boolean).join(' / ')

  return (
    <div className="company-card">
      <div className="company-card__label">COMPANY</div>
      <div className="company-card__name">{data.name}</div>
      {meta && <div className="company-card__meta">{meta}</div>}
      <div className="company-card__stats">
        {data.candidates_in_flight ?? 0} in flight
      </div>
      {(data.open_roles || []).length > 0 && (
        <div className="company-card__section">
          <div className="company-card__section-label">Open roles</div>
          {data.open_roles.map((r, i) => (
            <div key={i} className="company-card__role-row">
              <span className="company-card__role-title">{r.title}</span>
              {r.agreement_status && (
                <span
                  className="company-card__agreement-chip"
                  style={{ color: agreementColor(r.agreement_status) }}
                >
                  {r.agreement_status.toUpperCase()}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
