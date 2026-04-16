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

function firstSentence(body) {
  if (!body) return ''
  const match = body.match(/^.+?[.!?](?:\s|$)/)
  return match ? match[0].trim() : body.slice(0, 120)
}

// ── MessageCard ───────────────────────────────────────────

function MessageCard({ message, onApprove, onHold, onSend, onSaveEdit, onDelete }) {
  const [editing, setEditing]   = useState(false)
  const [editBody, setEditBody] = useState(message.body)
  const [saving, setSaving]     = useState(false)
  const [acting, setActing]     = useState(false)
  const [actionError, setActionError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletingMsg, setDeletingMsg]     = useState(false)

  const candidateName = message.candidates
    ? `${message.candidates.first_name} ${message.candidates.last_name}`
    : 'Unknown candidate'

  // Subject format is "Name — Role at Company" — extract role part
  const rolePart = message.subject
    ? message.subject.replace(/^[^—\-]+[—\-]\s*/, '')
    : null

  const { status } = message
  const isDrafted  = status === 'drafted'
  const isApproved = status === 'approved'
  const isHeld     = status === 'held_for_review'

  async function handleApproveAndCopy() {
    setActing(true)
    setActionError(null)
    try { await navigator.clipboard.writeText(message.body ?? '') } catch {}
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

  async function handleCopyAndSend() {
    setActing(true)
    setActionError(null)
    try { await navigator.clipboard.writeText(message.body ?? '') } catch {}
    const err = await onSend(message.id)
    if (err) setActionError('Couldn\'t mark as sent. Try again.')
    setActing(false)
  }

  async function handleSave() {
    setSaving(true)
    await onSaveEdit(message.id, editBody)
    setEditing(false)
    setSaving(false)
  }

  if (editing) {
    return (
      <div className={`queue-card queue-card--${status}`}>
        <div className="queue-card-header">
          <span className="queue-candidate-name">{candidateName}</span>
          {rolePart && <span className="queue-role-name">{rolePart}</span>}
        </div>
        <textarea
          className="message-textarea"
          value={editBody}
          onChange={e => setEditBody(e.target.value)}
          rows={10}
        />
        <div className="queue-card-actions">
          <button className="btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button className="btn-ghost btn-sm" onClick={() => { setEditBody(message.body); setEditing(false) }}>
            Cancel
          </button>
        </div>
        {actionError && <p className="inline-error">{actionError}</p>}
      </div>
    )
  }

  return (
    <div className={`queue-card queue-card--${status}`}>
      <div className="queue-card-header">
        <span className="queue-candidate-name">{candidateName}</span>
        {rolePart && <span className="queue-role-name">{rolePart}</span>}
      </div>
      <p className="queue-preview">{firstSentence(message.body)}</p>
      <div className="queue-card-actions">
        <button className="btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit</button>
        {(isDrafted || isHeld) && (
          <button className="btn-primary btn-sm" onClick={handleApproveAndCopy} disabled={acting}>
            {acting ? 'Copying…' : 'Approve & Copy'}
          </button>
        )}
        {isApproved && (
          <button className="btn-primary btn-sm" onClick={handleCopyAndSend} disabled={acting}>
            {acting ? 'Copying…' : 'Copy & Send'}
          </button>
        )}
        {(isDrafted || isApproved) && (
          <button className="btn-ghost btn-sm" onClick={handleHold} disabled={acting}>Hold</button>
        )}
        {isDrafted && !confirmDelete && (
          <button className="btn-ghost btn-sm" style={{ marginLeft: 'auto', color: 'var(--color-error)' }} onClick={() => setConfirmDelete(true)}>
            Delete
          </button>
        )}
      </div>
      {confirmDelete && (
        <div className="inline-confirm">
          <span>Delete this draft?</span>
          <button className="btn-confirm-yes" onClick={async () => {
            setDeletingMsg(true)
            const err = await onDelete(message.id)
            if (err) { setActionError('Couldn\'t delete.'); setDeletingMsg(false); setConfirmDelete(false) }
          }} disabled={deletingMsg}>{deletingMsg ? 'Deleting…' : 'Yes, delete'}</button>
          <button className="btn-confirm-cancel" onClick={() => setConfirmDelete(false)}>Cancel</button>
        </div>
      )}
      {actionError && <p className="inline-error">{actionError}</p>}
    </div>
  )
}

// ── Queue page ────────────────────────────────────────────

export default function Queue() {
  const { recruiter } = useRecruiter()
  const [messages, setMessages]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [activeTab, setActiveTab] = useState('drafted')

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
          <div className="queue-skeleton">
            {[80, 65, 75].map((w, i) => (
              <div key={i} className="queue-skeleton-card">
                <div className="skeleton skeleton-line" style={{ width: `${w}%` }} />
                <div className="skeleton skeleton-line skeleton-line--sm" style={{ width: `${w - 20}%` }} />
              </div>
            ))}
          </div>
        ) : fetchError ? (
          <div className="page-error">
            <p className="page-error-title">Something went wrong</p>
            <p className="page-error-body">{fetchError}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">{
              activeTab === 'drafted'  ? "You're clear. Nothing waiting." :
              activeTab === 'approved' ? 'No approved messages.' :
              activeTab === 'sent'     ? 'Nothing sent yet.' :
              activeTab === 'held_for_review' ? 'Nothing held.' :
              "You're clear. Nothing waiting."
            }</p>
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
