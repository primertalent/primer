function agreementColor(status) {
  if (status === 'signed') return 'var(--signal-green)'
  if (status === 'missing') return 'var(--signal-amber)'
  return 'var(--mute)'
}

function fmtComp(min, max, type) {
  if (!min && !max) return null
  const fmt = n => n ? `$${Number(n).toLocaleString()}` : null
  const range = [fmt(min), fmt(max)].filter(Boolean).join(' – ')
  return type ? `${range} ${type}` : range
}

export default function RoleCard({ data }) {
  if (!data || data.error) return null

  const comp = fmtComp(data.comp_min, data.comp_max, data.comp_type)
  const statusLabel = data.status
    ? data.status.charAt(0).toUpperCase() + data.status.slice(1)
    : null
  const insightLine = statusLabel
    ? `${statusLabel}. ${data.pipeline_count ?? 0} in process.`
    : null

  return (
    <div className="role-card">
      <div className="role-card__label">ROLE</div>
      <div className="role-card__title">{data.title}</div>
      {data.clients?.name && (
        <div className="role-card__client">{data.clients.name}</div>
      )}
      {comp && (
        <div className="role-card__comp">{comp}</div>
      )}
      {insightLine && (
        <div className="role-card__insight">{insightLine}</div>
      )}
      {data.agreement_status && (
        <div className="role-card__agreement">
          <span
            className="role-card__agreement-chip"
            style={{ color: agreementColor(data.agreement_status) }}
          >
            {data.agreement_status.toUpperCase()}
          </span>
        </div>
      )}
    </div>
  )
}
