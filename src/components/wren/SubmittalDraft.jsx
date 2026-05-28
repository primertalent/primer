import { useState } from 'react'

export default function SubmittalDraft({ data, isLatest }) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(isLatest)

  // Sync expanded state when isLatest changes (e.g. when a newer draft arrives)
  if (isLatest && !expanded) setExpanded(true)

  function copy() {
    navigator.clipboard.writeText(data.draft_text || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`submittal-draft${isLatest ? '' : ' submittal-draft--collapsed'}`}>
      <div className="submittal-draft__header" onClick={() => setExpanded(e => !e)}>
        <span className="submittal-draft__label">
          {data.is_revision ? 'REVISED DRAFT' : 'SUBMITTAL DRAFT'}
          {data.role_title && ` — ${data.role_title}`}
          {data.client_name && ` / ${data.client_name}`}
        </span>
        {!isLatest && (
          <span className="submittal-draft__older">earlier draft</span>
        )}
        <span className="submittal-draft__toggle">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <>
          <pre className="submittal-draft__body">{data.draft_text}</pre>
          <div className="submittal-draft__actions">
            <button className="btn-ghost submittal-draft__copy" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
