import { useEffect, useState } from 'react'
import AppLayout from '../components/AppLayout'
import { useRecruiter } from '../hooks/useRecruiter'
import { supabase } from '../lib/supabase'

// ── Constants ─────────────────────────────────────────────

const TABS = [
  { key: 'all',             label: 'All' },
  { key: 'drafted',         label: 'To Review' },
  { key: 'approved',        label: 'Approved' },
  { key: 'sent',            label: 'Sent' },
  { key: 'held_for_review', label: 'Held' },
]

const CHANNEL_LABELS = {
  email:    'Email',
  linkedin: 'LinkedIn',
  text:     'Text',
}

const STATUS_LABELS = {
  drafted:         'To Review',
  approved:        'Approved',
  sent:            'Sent',
  held_for_review: 'Held',
}

function formatTime(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month:  'short',
    day:    'numeric',
    hour:   'numeric',
    minute: '2-digit',
  })
}

function bodyPreview(body) {
  if (!body) return ''
  return body.length > 150 ? body.slice(0, 150) + '…' : body
}

// ── MessageCard ───────────────────────────────────────────

function MessageCard({ message, onApprove, onHold, onSend, onSaveEdit, onDelete }) {
  const [editing, setEditing]   = useState(false)
  const [editBody, setEditBody] = useState(message.body)
  const [saving, setSaving]     = useState(false)
  const [acting, setActing]     = useState(false)
  const [actionError, setActionError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletingMsg, setDeletingMsg] = useState(false)

  const candidateName = message.candidates
    ? `${message.candidates.first_name} ${message.candidates.last_name}`
    : 'Unknown candidate'

  const confidencePct = message.confidence_score != null
    ? `${Math.round(message.confidence_score * 100)}%`
    : null

  const { status } = message
  const isDrafted  = status === 'drafted'
  const isApproved = status === 'approved'
  const isHeld     = status === 'held_for_review'
  const isSent     = status === 'sent'

  async function handleApprove() {
    setActing(true)
    setActionError(null)
    const err = await onApprove(message.id)
    if (err) setActionError('Couldn\'t approve. Try again.')
    setActing(false)
  }

  async function handleHold() {
    setActing(true)
    setActionError(null)
    const err = await onHold(message.id)
    if (err) setActionError('Couldn\'t hold. Try again.')
    setActing(false)
  }

  async function handleSend() {
    setActing(true)
    setActionError(null)
    const err = await onSend(message.id)
    if (err) setActionError('Couldn\'t mark as sent. Try again.')
    setActing(false)
  }

  async function handleDelete() {
    setDeletingMsg(true)
    setActionError(null)
    const err = await onDelete(message.id)
    if (err) {
      setActionError('Couldn\'t delete. Try again.')
      setDeletingMsg(false)
      setConfirmDelete(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    await onSaveEdit(message.id, editBody)
    setEditing(false)
    setSaving(false)
  }

  function handleCancelEdit() {
    setEditBody(message.body)
    setEditing(false)
  }

  return (
    <div className={`message-card message-card--${status}`}>

      {/* Card header row */}
      <div className="message-card-header">
        <div className="message-card-left">
          <span className={`channel-badge channel-badge--${message.channel}`}>
            {CHANNEL_LABELS[message.channel] ?? message.channel}
          </span>
          <span className="message-candidate">{candidateName}</span>
          {confidencePct && (
            <span className="confidence-score" title="AI confidence score">
              {confidencePct}
            </span>
          )}
        </div>
        <div className="message-card-right">
          <span className={`status-badge status-badge--${status}`}>
            {STATUS_LABELS[status] ?? status}
          </span>
          <span className="message-time">{formatTime(message.created_at)}</span>
        </div>
      </div>

      {/* Subject */}
      {message.subject && (
        <p className="message-subject">{message.subject}</p>
      )}

      {/* Body — edit mode or preview */}
      {editing ? (
        <div className="message-edit">
          <textarea
            className="message-textarea"
            value={editBody}
            onChange={e => setEditBody(e.target.value)}
            rows={8}
          />
          <div className="message-edit-actions">
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn-ghost" onClick={handleCancelEdit}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="message-preview">{bodyPreview(message.body)}</p>
      )}

      {/* Actions */}
      {!isSent && (
        <div>
          <div className="message-actions">
            {(isDrafted || isHeld) && (
              <button
                className="btn-action btn-action--approve"
                onClick={handleApprove}
                disabled={acting}
              >
                Approve
              </button>
            )}
            {isApproved && (
              <button
                className="btn-action btn-action--send"
                onClick={handleSend}
                disabled={acting}
              >
                Send
              </button>
            )}
            {!editing && (
              <button className="btn-action" onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
            {(isDrafted || isApproved) && (
              <button
                className="btn-action btn-action--hold"
                onClick={handleHold}
                disabled={acting}
              >
                Hold
              </button>
            )}
            {isDrafted && !confirmDelete && (
              <button
                className="btn-action btn-action--delete"
                onClick={() => setConfirmDelete(true)}
                disabled={acting || deletingMsg}
              >
                Delete
              </button>
            )}
          </div>
          {confirmDelete && (
            <div className="inline-confirm">
              <span>Delete this draft?</span>
              <button className="btn-confirm-yes" onClick={handleDelete} disabled={deletingMsg}>
                {deletingMsg ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button className="btn-confirm-cancel" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          )}
          {actionError && <p className="inline-error">{actionError}</p>}
        </div>
      )}
    </div>
  )
}

// ── Queue page ────────────────────────────────────────────

export default function Queue() {
  const { recruiter } = useRecruiter()
  const [messages, setMessages]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => {
    if (!recruiter?.id) return

    async function fetchMessages() {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          candidates ( first_name, last_name )
        `)
        .eq('recruiter_id', recruiter.id)
        .order('created_at', { ascending: false })

      if (error) setFetchError('Couldn\'t load the queue. Try refreshing.')
      else setMessages(data ?? [])
      setLoading(false)
    }

    fetchMessages()
  }, [recruiter?.id])

  // Optimistic local state updates — no refetch needed

  async function handleApprove(id) {
    const { error } = await supabase
      .from('messages')
      .update({ status: 'approved' })
      .eq('id', id)
    if (!error) setMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'approved' } : m))
    return error ?? null
  }

  async function handleHold(id) {
    const { error } = await supabase
      .from('messages')
      .update({ status: 'held_for_review' })
      .eq('id', id)
    if (!error) setMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'held_for_review' } : m))
    return error ?? null
  }

  async function handleSend(id) {
    const sentAt = new Date().toISOString()
    const { error } = await supabase
      .from('messages')
      .update({ status: 'sent', sent_at: sentAt })
      .eq('id', id)
    if (!error) setMessages(prev => prev.map(m =>
      m.id === id ? { ...m, status: 'sent', sent_at: sentAt } : m
    ))
    return error ?? null
  }

  async function handleSaveEdit(id, body) {
    const { error } = await supabase
      .from('messages')
      .update({ body })
      .eq('id', id)
    if (!error) {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, body } : m))
    }
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('messages').delete().eq('id', id)
    if (!error) setMessages(prev => prev.filter(m => m.id !== id))
    return error ?? null
  }

  function tabCount(key) {
    if (key === 'all') return messages.length
    return messages.filter(m => m.status === key).length
  }

  const filtered = activeTab === 'all'
    ? messages
    : messages.filter(m => m.status === activeTab)

  return (
    <AppLayout>
      <div className="roles-header">
        <div>
          <h1 className="brief-headline">Queue</h1>
          <p className="brief-date">
            {loading ? 'Loading…' : `${messages.length} ${messages.length === 1 ? 'message' : 'messages'}`}
          </p>
        </div>
      </div>

      <div className="filter-tabs">
        {TABS.map(tab => {
          const count = tabCount(tab.key)
          return (
            <button
              key={tab.key}
              className={`filter-tab${activeTab === tab.key ? ' filter-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {count > 0 && (
                <span className="tab-count">{count}</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="message-list">
        {loading ? (
          <div className="loading-state"><div className="spinner" /></div>
        ) : fetchError ? (
          <div className="page-error">
            <p className="page-error-title">Something went wrong</p>
            <p className="page-error-body">{fetchError}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">{
              activeTab === 'drafted'  ? 'Nothing to review.' :
              activeTab === 'approved' ? 'No approved messages.' :
              activeTab === 'sent'     ? 'Nothing sent yet.' :
              activeTab === 'held_for_review' ? 'Nothing held.' :
              'Queue is clear.'
            }</p>
            {activeTab === 'all' && (
              <p className="empty-state-body">
                Draft a submission from a candidate card or kanban board to populate your queue.
              </p>
            )}
          </div>
        ) : (
          filtered.map(message => (
            <MessageCard
              key={message.id}
              message={message}
              onApprove={handleApprove}
              onHold={handleHold}
              onSend={handleSend}
              onSaveEdit={handleSaveEdit}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </AppLayout>
  )
}
