import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useRecruiter } from '../hooks/useRecruiter'
import { supabase } from '../lib/supabase'

const COMP_TYPES = [
  { value: 'salary',             label: 'Salary' },
  { value: 'hourly',             label: 'Hourly' },
  { value: 'contract',           label: 'Contract' },
  { value: 'equity_plus_salary', label: 'Equity + Salary' },
]

const STATUS_OPTIONS = [
  { value: 'open',      label: 'Open' },
  { value: 'on_hold',   label: 'On Hold' },
  { value: 'filled',    label: 'Filled' },
  { value: 'cancelled', label: 'Cancelled' },
]

// ── Process steps builder ─────────────────────────────────

function StepsBuilder({ steps, onChange }) {
  function addStep() {
    onChange([...steps, ''])
  }

  function updateStep(i, val) {
    onChange(steps.map((s, idx) => idx === i ? val : s))
  }

  function removeStep(i) {
    onChange(steps.filter((_, idx) => idx !== i))
  }

  function moveUp(i) {
    if (i === 0) return
    const next = [...steps]
    ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
    onChange(next)
  }

  function moveDown(i) {
    if (i === steps.length - 1) return
    const next = [...steps]
    ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
    onChange(next)
  }

  return (
    <div className="steps-builder">
      {steps.map((step, i) => (
        <div key={i} className="step-item">
          <div className="step-reorder">
            <button type="button" className="step-btn" onClick={() => moveUp(i)} disabled={i === 0} aria-label="Move up">↑</button>
            <button type="button" className="step-btn" onClick={() => moveDown(i)} disabled={i === steps.length - 1} aria-label="Move down">↓</button>
          </div>
          <span className="step-index">{i + 1}</span>
          <input
            type="text"
            className="step-input"
            value={step}
            onChange={e => updateStep(i, e.target.value)}
            placeholder={`Stage ${i + 1}`}
          />
          <button type="button" className="step-btn step-btn--remove" onClick={() => removeStep(i)} aria-label="Remove stage">×</button>
        </div>
      ))}
      <button type="button" className="btn-ghost steps-add-btn" onClick={addStep}>+ Add stage</button>
    </div>
  )
}

// ── Edit Role form ────────────────────────────────────────

export default function EditRole() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { recruiter } = useRecruiter()

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [clientName, setClientName] = useState('')

  // Form state
  const [title, setTitle]       = useState('')
  const [status, setStatus]     = useState('open')
  const [compMin, setCompMin]   = useState('')
  const [compMax, setCompMax]   = useState('')
  const [compType, setCompType] = useState('salary')
  const [steps, setSteps]       = useState([])
  const [notes, setNotes]       = useState('')

  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (!id || !recruiter?.id) return

    supabase
      .from('roles')
      .select('title, status, comp_min, comp_max, comp_type, process_steps, notes, clients(name)')
      .eq('id', id)
      .eq('recruiter_id', recruiter.id)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setNotFound(true)
        } else {
          setTitle(data.title ?? '')
          setStatus(data.status ?? 'open')
          setCompMin(data.comp_min != null ? String(data.comp_min) : '')
          setCompMax(data.comp_max != null ? String(data.comp_max) : '')
          setCompType(data.comp_type ?? 'salary')
          setSteps(data.process_steps ?? [])
          setNotes(data.notes ?? '')
          setClientName(data.clients?.name ?? '')
        }
        setLoading(false)
      })
  }, [id, recruiter?.id])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError('Job title is required.')
      return
    }
    if (steps.some(s => !s.trim())) {
      setError('All process stages must have a name.')
      return
    }

    setSaving(true)

    const { error: updateErr } = await supabase
      .from('roles')
      .update({
        title:         title.trim(),
        status,
        comp_min:      compMin ? Number(compMin) : null,
        comp_max:      compMax ? Number(compMax) : null,
        comp_type:     compType || null,
        process_steps: steps.filter(s => s.trim()),
        notes:         notes.trim() || null,
      })
      .eq('id', id)
      .eq('recruiter_id', recruiter.id)

    if (updateErr) {
      setError(updateErr.message)
      setSaving(false)
      return
    }

    navigate(`/roles/${id}`)
  }

  if (loading) {
    return <AppLayout><p className="muted">Loading…</p></AppLayout>
  }

  if (notFound) {
    return (
      <AppLayout>
        <p className="muted">Role not found.</p>
        <button className="btn-ghost" style={{ marginTop: 16 }} onClick={() => navigate('/roles')}>
          Go back
        </button>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="form-page-header">
        <button className="btn-back" onClick={() => navigate(`/roles/${id}`)}>← Back</button>
        <div>
          <h1 className="page-title">Edit Role</h1>
          {clientName && <p className="page-subtitle">{clientName}</p>}
        </div>
      </div>

      <form className="role-form" onSubmit={handleSubmit} noValidate>

        <div className="form-two-col">
          <div className="form-field">
            <label className="form-label" htmlFor="title">Job Title <span className="required">*</span></label>
            <input
              id="title"
              type="text"
              className="field-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="status">Status</label>
            <select
              id="status"
              className="field-input"
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-field">
          <label className="form-label">Compensation</label>
          <div className="comp-row">
            <div className="comp-input-wrap">
              <span className="comp-prefix">$</span>
              <input
                type="number"
                className="field-input comp-input"
                value={compMin}
                onChange={e => setCompMin(e.target.value)}
                placeholder="Min"
                min="0"
              />
            </div>
            <span className="comp-sep">–</span>
            <div className="comp-input-wrap">
              <span className="comp-prefix">$</span>
              <input
                type="number"
                className="field-input comp-input"
                value={compMax}
                onChange={e => setCompMax(e.target.value)}
                placeholder="Max"
                min="0"
              />
            </div>
            <select
              className="field-input comp-type-select"
              value={compType}
              onChange={e => setCompType(e.target.value)}
            >
              {COMP_TYPES.map(ct => (
                <option key={ct.value} value={ct.value}>{ct.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-field">
          <label className="form-label">Hiring Process</label>
          <p className="form-hint">Reorder or rename stages. Changes affect future pipeline views.</p>
          <StepsBuilder steps={steps} onChange={setSteps} />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            className="field-input field-textarea"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
          />
        </div>

        {error && <p className="error">{error}</p>}

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button type="button" className="btn-ghost" onClick={() => navigate(`/roles/${id}`)}>
            Cancel
          </button>
        </div>

      </form>
    </AppLayout>
  )
}
