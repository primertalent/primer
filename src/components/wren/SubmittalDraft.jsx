import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import GoogleConnectCard from './GoogleConnectCard'

// Returns lines containing unresolved flag markers. Three variants: [NEEDS:, [NOT CAPTURED, [FLAG:
function findUnresolvedFlags(text) {
  return (text || '')
    .split('\n')
    .filter(line => /\[(?:NEEDS:|NOT CAPTURED|FLAG:)/i.test(line))
    .map(line => line.trim())
    .slice(0, 3)
}

export default function SubmittalDraft({ data, isLatest, gmailConnected, onSent, onTokenRevoked }) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(isLatest)
  const [actionsHeld, setActionsHeld] = useState(false)
  const [showSendForm, setShowSendForm] = useState(false)
  const [toEmail, setToEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sentAt, setSentAt] = useState(null)
  const [sendError, setSendError] = useState(null)
  const [tokenRevoked, setTokenRevoked] = useState(false)
  const [flagWarning, setFlagWarning] = useState(false)
  const [flagLines, setFlagLines] = useState([])

  // Sync expanded when isLatest changes (newer draft arriving collapses older ones)
  if (isLatest && !expanded) setExpanded(true)

  function copy() {
    navigator.clipboard.writeText(data.draft_text || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function send(override = false) {
    if (!toEmail.trim() || sending) return

    // Flag check on first click — show warning and require explicit second click.
    // override is only set by the SEND ANYWAY button; it is never derivable from
    // model output or ingested content (the send endpoint is not a tool).
    if (!override) {
      const found = findUnresolvedFlags(data.draft_text || '')
      if (found.length > 0) {
        setFlagLines(found)
        setFlagWarning(true)
        return
      }
    }

    setSending(true)
    setSendError(null)
    setFlagWarning(false)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      const subject = [
        data.candidate_name || 'Candidate',
        data.role_title || 'Role',
      ].join(' - ')

      const res = await fetch('/api/gmail-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          to:           toEmail.trim(),
          subject,
          body:         data.draft_text || '',
          pipeline_id:  data.pipeline_id  ?? null,
          candidate_id: data.candidate_id ?? null,
          user_approved: true,
          override,
        }),
      })

      const result = await res.json()

      if (result.error === 'unresolved_flags') {
        setFlagLines(result.flags || [])
        setFlagWarning(true)
        setSending(false)
        return
      }
      if (result.error === 'google_token_revoked') {
        setTokenRevoked(true)
        setShowSendForm(false)
        setSending(false)
        if (onTokenRevoked) onTokenRevoked()
        return
      }
      if (result.error === 'auth_required') {
        setSendError('Gmail not connected — use the Connect button below.')
        setSending(false)
        return
      }
      if (result.error) {
        setSendError(result.detail || result.error)
        setSending(false)
        return
      }

      const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      setSentAt(ts)
      setShowSendForm(false)
      if (onSent) onSent(toEmail.trim(), ts)
    } catch (err) {
      setSendError(err.message || 'Send failed')
      setSending(false)
    }
  }

  const canSend = !tokenRevoked && (gmailConnected ?? data.gmail_connected)

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
        {sentAt && (
          <span className="submittal-draft__sent">sent {sentAt}</span>
        )}
        <span className="submittal-draft__toggle">
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}>
            <path d="M1 1l4 4 4-4" />
          </svg>
        </span>
      </div>

      {expanded && (
        <>
          <pre className="submittal-draft__body">{data.draft_text}</pre>

          {/* Send form — shown when APPROVE & SEND clicked */}
          {showSendForm && (
            <div className="submittal-draft__send-form">
              <label className="submittal-draft__send-label">TO</label>
              <input
                type="email"
                className="submittal-draft__send-input"
                placeholder="hiring.manager@company.com"
                value={toEmail}
                onChange={e => setToEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                autoFocus
              />
              <button
                className="submittal-draft__send-confirm"
                onClick={send}
                disabled={!toEmail.trim() || sending}
              >
                {sending ? 'Sending…' : 'SEND'}
              </button>
              <button
                className="submittal-draft__send-cancel"
                onClick={() => { setShowSendForm(false); setSendError(null) }}
              >
                Cancel
              </button>
            </div>
          )}

          {flagWarning && (
            <div className="submittal-draft__flag-warning">
              <span className="submittal-draft__flag-label">
                {flagLines.length} unresolved {flagLines.length === 1 ? 'flag' : 'flags'} in this draft
              </span>
              {flagLines.map((line, i) => (
                <div key={i} className="submittal-draft__flag-line">{line}</div>
              ))}
              <div className="submittal-draft__flag-actions">
                <button
                  className="submittal-draft__send-confirm"
                  onClick={() => send(true)}
                  disabled={sending}
                >
                  {sending ? 'Sending…' : 'SEND ANYWAY'}
                </button>
                <button
                  className="submittal-draft__send-cancel"
                  onClick={() => { setFlagWarning(false); setFlagLines([]) }}
                >
                  Go back
                </button>
              </div>
            </div>
          )}

          {sendError && (
            <div className="submittal-draft__send-error">{sendError}</div>
          )}

          {/* Revocation notice — replaces action row when token is cleared */}
          {isLatest && tokenRevoked && (
            <div className="submittal-draft__revoked">
              <span className="submittal-draft__revoked-msg">
                Google access was revoked. Reconnect to send.
              </span>
              <div className="submittal-draft__connect-inline">
                <GoogleConnectCard />
              </div>
            </div>
          )}

          {/* Action row */}
          {isLatest && !actionsHeld && !sentAt && !tokenRevoked && (
            <div className="submittal-draft__actions">
              <button className="btn-ghost submittal-draft__copy" onClick={copy}>
                {copied ? 'Copied' : 'Copy'}
              </button>

              {canSend ? (
                !showSendForm && (
                  <button
                    className="submittal-draft__action-btn submittal-draft__action-btn--primary"
                    onClick={() => setShowSendForm(true)}
                  >
                    APPROVE &amp; SEND
                  </button>
                )
              ) : (
                <div className="submittal-draft__connect-inline">
                  <GoogleConnectCard />
                </div>
              )}

              <button
                className="submittal-draft__action-btn"
                onClick={() => setActionsHeld(true)}
              >
                HOLD
              </button>
            </div>
          )}

          {/* Copy-only row for non-latest or held drafts */}
          {(!isLatest || actionsHeld || sentAt) && (
            <div className="submittal-draft__actions">
              <button className="btn-ghost submittal-draft__copy" onClick={copy}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
