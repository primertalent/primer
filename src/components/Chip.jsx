// All icons: 1.5px-stroke SVG in currentColor, no fill. Rule 5 — no emoji, no icon library.
const STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }

function IconResume() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" {...STROKE}>
      <path d="M2 1.5h5.5L10 4v6.5H2V1.5z" />
      <path d="M7.5 1.5V4H10" />
    </svg>
  )
}

function IconJd() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" {...STROKE}>
      <rect x="2" y="3" width="8" height="8" />
      <path d="M4.5 3V2h3v1" />
    </svg>
  )
}

function IconNotes() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" {...STROKE}>
      <rect x="2" y="1" width="8" height="10" />
      <path d="M4 4.5h4M4 7h4M4 9.5h2" />
    </svg>
  )
}

function IconTranscript() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" {...STROKE}>
      <rect x="4" y="1" width="4" height="6" rx="2" />
      <path d="M2 7.5a4 4 0 0 0 8 0" />
      <line x1="6" y1="11.5" x2="6" y2="9.5" />
    </svg>
  )
}

function IconUrl() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" {...STROKE}>
      <path d="M4.5 7.5a3 3 0 0 0 4.25 0l1.5-1.5a3 3 0 0 0-4.25-4.25L4.5 3.25" />
      <path d="M7.5 4.5a3 3 0 0 0-4.25 0L1.75 6a3 3 0 0 0 4.25 4.25L7.5 8.75" />
    </svg>
  )
}

function IconWarning() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" {...STROKE}>
      <path d="M6 1.5 10.5 10H1.5L6 1.5z" />
      <line x1="6" y1="5" x2="6" y2="7.5" />
      <circle cx="6" cy="9" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconDoc() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" {...STROKE}>
      <rect x="2" y="1" width="8" height="10" />
    </svg>
  )
}

function ChipIcon({ type, error }) {
  if (error) return <IconWarning />
  switch (type) {
    case 'resume':     return <IconResume />
    case 'jd':         return <IconJd />
    case 'notes':      return <IconNotes />
    case 'transcript': return <IconTranscript />
    case 'url':        return <IconUrl />
    default:           return <IconDoc />
  }
}

export default function Chip({ type, label, loading, error, onRemove, readonly }) {
  const className = [
    'wren-chip',
    loading ? 'wren-chip--loading' : error ? 'wren-chip--error' : type ? `wren-chip--${type}` : '',
  ].filter(Boolean).join(' ')

  return (
    <span className={className}>
      {!loading && (
        <span className="wren-chip-icon">
          <ChipIcon type={type} error={error} />
        </span>
      )}
      <span className="wren-chip-label">{label}</span>
      {!readonly && onRemove && (
        <button
          className="wren-chip-remove"
          onClick={onRemove}
          title="Remove"
          aria-label="Remove"
        >
          ×
        </button>
      )}
    </span>
  )
}
