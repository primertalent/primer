import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useRecruiter } from '../hooks/useRecruiter'
import { supabase } from '../lib/supabase'
import { generateText } from '../lib/ai/index.js'
import { buildJobDescriptionMessages } from '../lib/prompts/jobDescriptionWriter.js'

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
  const [feeType, setFeeType]   = useState('pct')
  const [feePct, setFeePct]     = useState('')
  const [feeFlat, setFeeFlat]   = useState('')

  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)

  // JD writer
  const [jdWriter, setJdWriter] = useState({ phase: 'idle', result: '', error: '' })
  // hold full role context after load for comp hints
  const [roleContext, setRoleContext] = useState(null)

  useEffect(() => {
    if (!id || !recruiter?.id) return

    supabase
      .from('roles')
      .select('title, status, comp_min, comp_max, comp_type, process_steps, notes, placement_fee_pct, placement_fee_flat, clients(name)')
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
          if (data.placement_fee_flat != null) {
            setFeeType('flat')
            setFeeFlat(String(data.placement_fee_flat))
          } else if (data.placement_fee_pct != null) {
            setFeeType('pct')
            setFeePct(String(data.placement_fee_pct * 100))
          }
          setRoleContext({ title: data.title, clients: { name: data.clients?.name }, comp_min: data.comp_min, comp_max: data.comp_max, comp_type: data.comp_type })
        }
        setLoading(false)
      })
  }, [id, recruiter?.id])

  async function handleGenerateJD() {
    if (!notes.trim()) return
    setJdWriter({ phase: 'generating', result: '', error: '' })
    try {
      const ctx = roleContext ?? { title: title.trim() || null, clients: { name: clientName || null }, comp_min: compMin ? Number(compMin) : null, comp_max: compMax ? Number(compMax) : null, comp_type: compType || null }
      const result = await generateText({ messages: buildJobDescriptionMessages(notes, ctx), maxTokens: 2048 })
      setJdWriter({ phase: 'confirm', result, error: '' })
    } catch {
      setJdWriter({ phase: 'error', result: '', error: 'Could not generate job description. Try again.' })
    }
  }

  function confirmJD() {
    setNotes(jdWriter.result)
    setJdWriter({ phase: 'idle', result: '', error: '' })
  }

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
        comp_min:        compMin ? Number(compMin) : null,
        comp_max:        compMax ? Number(compMax) : null,
        target_comp_min: compMin ? Number(compMin) : null,
        target_comp_max: compMax ? Number(compMax) : null,
        comp_type:       compType || null,
        process_steps: steps.filter(s => s.trim()),
        notes:         notes.trim() || null,
        placement_fee_pct:  feeType === 'pct' && feePct ? Number(feePct) / 100 : null,
        placement_fee_flat: feeType === 'flat' && feeFlat ? Number(feeFlat) : null,
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
          <label className="form-label">Placement Fee</label>
          <div className="fee-toggle">
            <button type="button" className={`fee-toggle-btn${feeType === 'pct' ? ' fee-toggle-btn--active' : ''}`} onClick={() => setFeeType('pct')}>% of comp</button>
            <button type="button" className={`fee-toggle-btn${feeType === 'flat' ? ' fee-toggle-btn--active' : ''}`} onClick={() => setFeeType('flat')}>Flat fee</button>
          </div>
          {feeType === 'pct' ? (
            <div className="comp-input-wrap" style={{ marginTop: 8 }}>
              <input type="number" className="field-input comp-input" value={feePct} onChange={e => setFeePct(e.target.value)} placeholder="e.g. 20" min="0" max="100" />
              <span style={{ marginLeft: 8, color: 'var(--mute)', fontSize: 14 }}>%</span>
            </div>
          ) : (
            <div className="comp-input-wrap" style={{ marginTop: 8 }}>
              <span className="comp-prefix">$</span>
              <input type="number" className="field-input comp-input" value={feeFlat} onChange={e => setFeeFlat(e.target.value)} placeholder="Flat fee in dollars" min="0" />
            </div>
          )}
        </div>

        <div className="form-field">
          <label className="form-label">Hiring Process</label>
          <p className="form-hint">Reorder or rename stages. Changes affect future pipeline views.</p>
          <StepsBuilder steps={steps} onChange={setSteps} />
        </div>

        <div className="form-field">
          <div className="jd-notes-header">
            <label className="form-label" htmlFor="notes">Notes</label>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={handleGenerateJD}
              disabled={jdWriter.phase === 'generating' || !notes.trim()}
            >
              {jdWriter.phase === 'generating' ? 'Generating…' : 'Generate JD'}
            </button>
          </div>
          <textarea
            id="notes"
            className="field-input field-textarea"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
          />
          {jdWriter.phase === 'error' && <p className="error">{jdWriter.error}</p>}
        </div>

        {/* JD writer confirmation modal */}
        {jdWriter.phase === 'confirm' && (
          <div className="modal-overlay">
            <div className="modal modal--wide">
              <div className="modal-header">
                <h3 className="modal-title">Generated Job Description</h3>
                <button className="modal-close" onClick={() => setJdWriter({ phase: 'idle', result: '', error: '' })}>×</button>
              </div>
              <pre className="jd-preview">{jdWriter.result}</pre>
              <div className="modal-footer">
                <button className="btn-primary" onClick={confirmJD}>Use this JD</button>
                <button className="btn-ghost" onClick={() => setJdWriter({ phase: 'idle', result: '', error: '' })}>Cancel</button>
              </div>
            </div>
          </div>
        )}

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
