export const CHIP_ICONS = {
  resume:     '📄',
  jd:         '📋',
  transcript: '🎙️',
  notes:      '📝',
  url:        '🔗',
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
          {error ? '⚠' : (CHIP_ICONS[type] ?? '📄')}
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
