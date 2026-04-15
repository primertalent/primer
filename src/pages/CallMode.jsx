import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useRecruiter } from '../hooks/useRecruiter'

const TYPE_OPTIONS = ['call', 'email', 'note', 'meeting']
const TYPE_LABELS  = { call: 'Call', email: 'Email', note: 'Note', meeting: 'Meeting' }

export default function CallMode() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { recruiter } = useRecruiter()

  const [candidate, setCandidate] = useState(null)
  const [pipelines, setPipelines]  = useState([])
  const [loading, setLoading]      = useState(true)

  const [type, setType]       = useState('call')
  const [notes, setNotes]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (!id || !recruiter?.id) return
    async function load() {
      const [candRes, pipeRes] = await Promise.allSettled([
        supabase.from('candidates').select('*').eq('id', id).single(),
        supabase
          .from('pipeline')
          .select('current_stage, roles(title, clients(name))')
          .eq('candidate_id', id)
          .eq('status', 'active'),
      ])
      if (candRes.status === 'fulfilled' && candRes.value.data) {
        setCandidate(candRes.value.data)
      }
      if (pipeRes.status === 'fulfilled') {
        setPipelines(pipeRes.value.data ?? [])
      }
      setLoading(false)
    }
    load()
  }, [id, recruiter?.id])

  async function handleSave() {
    if (!notes.trim() || saving) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('interactions').insert({
      recruiter_id: recruiter.id,
      candidate_id: id,
      type,
      direction: type === 'note' ? null : 'outbound',
      occurred_at: new Date().toISOString(),
      body: notes.trim(),
    })
    if (err) {
      setError('Couldn\'t save. Try again.')
      setSaving(false)
      return
    }
    setSaved(true)
    setNotes('')
    setSaving(false)
    setTimeout(() => setSaved(false), 3000)
  }

  function handleDone() {
    navigate(`/candidates/${id}`)
  }

  if (loading) {
    return (
      <div className="call-mode-shell">
        <div className="loading-state"><div className="spinner" /></div>
      </div>
    )
  }

  if (!candidate) {
    return (
      <div className="call-mode-shell">
        <p className="call-mode-not-found">Candidate not found.</p>
        <button className="btn-ghost" onClick={() => navigate('/candidates')}>Back</button>
      </div>
    )
  }

  const fullName = `${candidate.first_name} ${candidate.last_name}`

  return (
    <div className="call-mode-shell">

      {/* Header */}
      <div className="call-mode-header">
        <button className="call-mode-back" onClick={handleDone}>← Back</button>
        <div className="call-mode-candidate">
          <h1 className="call-mode-name">{fullName}</h1>
          {candidate.current_title && candidate.current_company && (
            <p className="call-mode-title">
              {candidate.current_title} · {candidate.current_company}
            </p>
          )}
        </div>
      </div>

      {/* Pipeline context */}
      {pipelines.length > 0 && (
        <div className="call-mode-pipeline">
          {pipelines.map((p, i) => (
            <span key={i} className="call-mode-pipeline-chip">
              {p.roles?.title ?? 'Unknown role'}
              {p.roles?.clients?.name ? ` @ ${p.roles.clients.name}` : ''}
              <span className="call-mode-stage"> · {p.current_stage}</span>
            </span>
          ))}
        </div>
      )}

      {/* Quick info */}
      <div className="call-mode-quick-info">
        {candidate.email && (
          <a href={`mailto:${candidate.email}`} className="call-mode-contact-link">
            {candidate.email}
          </a>
        )}
        {candidate.phone && (
          <a href={`tel:${candidate.phone}`} className="call-mode-contact-link">
            {candidate.phone}
          </a>
        )}
      </div>

      {/* Note input */}
      <div className="call-mode-note-area">
        <div className="call-mode-type-row">
          {TYPE_OPTIONS.map(t => (
            <button
              key={t}
              className={`call-mode-type-btn${type === t ? ' call-mode-type-btn--active' : ''}`}
              onClick={() => setType(t)}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <textarea
          className="call-mode-textarea"
          placeholder={type === 'call' ? 'Call notes…' : type === 'email' ? 'Email notes…' : type === 'meeting' ? 'Meeting notes…' : 'Note…'}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          autoFocus
        />
        {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
        <div className="call-mode-actions">
          <button
            className="call-mode-save-btn"
            onClick={handleSave}
            disabled={!notes.trim() || saving}
          >
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Log Note'}
          </button>
          <button className="call-mode-done-btn" onClick={handleDone}>
            Done
          </button>
        </div>
      </div>

    </div>
  )
}
