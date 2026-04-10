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

function MessageCard({ message, onApprove, onHold, onSend, onSaveEdit }) {
  const [editing, setEditing]   = useState(false)
  const [editBody, setEditBody] = useState(message.body)
  const [saving, setSaving]     = useState(false)
  const [acting, setActing]     = useState(false)

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
    await onApprove(message.id)
    setActing(false)
  }

  async function handleHold() {
    setActing(true)
    await onHold(message.id)
    setActing(false)
  }

  async function handleSend() {
    setActing(true)
    await onSend(message.id)
    setActing(false)
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

      if (!error) setMessages(data ?? [])
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
    if (!error) {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'approved' } : m))
    }
  }

  async function handleHold(id) {
    const { error } = await supabase
      .from('messages')
      .update({ status: 'held_for_review' })
      .eq('id', id)
    if (!error) {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'held_for_review' } : m))
    }
  }

  async function handleSend(id) {
    const sentAt = new Date().toISOString()
    const { error } = await supabase
      .from('messages')
      .update({ status: 'sent', sent_at: sentAt })
      .eq('id', id)
    if (!error) {
      setMessages(prev => prev.map(m =>
        m.id === id ? { ...m, status: 'sent', sent_at: sentAt } : m
      ))
    }
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

  function tabCount(key) {
    if (key === 'all') return messages.length
    return messages.filter(m => m.status === key).length
  }

  const filtered = activeTab === 'all'
    ? messages
    : messages.filter(m => m.status === activeTab)

  return (
    <AppLayout>
      <div className="queue-header">
        <h1 className="brief-headline">Queue</h1>
        <p className="brief-date">Review and action messages drafted by Primer</p>
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
          <p className="muted">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p className="muted">No messages here.</p>
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
            />
          ))
        )}
      </div>
    </AppLayout>
  )
}
