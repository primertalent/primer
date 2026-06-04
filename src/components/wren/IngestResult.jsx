import Chip, { CHIP_ICONS } from '../Chip'

const ACTION_LABEL = {
  created:  'Created',
  enriched: 'Enriched',
  matched:  'Matched',
  reused:   'Existing',
}

export default function IngestResult({ data }) {
  if (!data) return null
  if (data.error) {
    return (
      <div className="ingest-result ingest-result--error">
        <Chip type="notes" label={data.label || 'Document'} error readonly />
        <span className="ingest-result__summary">{data.error}</span>
      </div>
    )
  }

  const actionLabel = ACTION_LABEL[data.action]

  return (
    <div className="ingest-result">
      <Chip type={data.classification} label={data.label || data.classification} readonly />
      {data.what_happened && (
        <span className="ingest-result__summary">
          {actionLabel && <span className="ingest-result__action">{actionLabel} · </span>}
          {data.what_happened}
        </span>
      )}
    </div>
  )
}
