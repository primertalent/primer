import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useRecruiter } from '../hooks/useRecruiter'
import { supabase } from '../lib/supabase'

const COMP_TYPES = [
  { value: 'salary',            label: 'Salary' },
  { value: 'hourly',            label: 'Hourly' },
  { value: 'contract',          label: 'Contract' },
  { value: 'equity_plus_salary', label: 'Equity + Salary' },
]

const DEFAULT_STEPS = ['Sourced', 'Screen', 'Hiring Manager', 'Final Round', 'Offer', 'Placed']

// ── Client combobox ───────────────────────────────────────

function ClientCombobox({ clients, value, onChange }) {
  // value = { id: string|null, name: string, isNew: boolean }
  const [inputVal, setInputVal]   = useState(value.name)
  const [open, setOpen]           = useState(false)
  const [focused, setFocused]     = useState(false)
  const containerRef              = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(inputVal.toLowerCase())
  )

  const exactMatch = clients.some(
    c => c.name.toLowerCase() === inputVal.toLowerCase()
  )

  function handleInputChange(e) {
    const val = e.target.value
    setInputVal(val)
    setOpen(true)
    // If the user clears the field or types something new, reset selection
    onChange({ id: null, name: val, isNew: false })
  }

  function handleSelectExisting(client) {
    setInputVal(client.name)
    setOpen(false)
    onChange({ id: client.id, name: client.name, isNew: false })
  }

  function handleCreateNew() {
    setOpen(false)
    onChange({ id: null, name: inputVal.trim(), isNew: true })
  }

  const showCreateOption = inputVal.trim().length > 0 && !exactMatch

  return (
    <div className="client-combobox" ref={containerRef}>
      <input
        type="text"
        className="field-input"
        placeholder="Search or create a client…"
        value={inputVal}
        onChange={handleInputChange}
        onFocus={() => { setFocused(true); setOpen(true) }}
        autoComplete="off"
      />
      {value.isNew && (
        <p className="client-new-label">New client: will be created on save</p>
      )}
      {value.id && (
        <p className="client-new-label">Existing client selected</p>
      )}
      {open && (filtered.length > 0 || showCreateOption) && (
        <ul className="client-dropdown">
          {filtered.map(c => (
            <li
              key={c.id}
              className="client-option"
              onMouseDown={() => handleSelectExisting(c)}
            >
              {c.name}
            </li>
          ))}
          {showCreateOption && (
            <li
              className="client-option client-option--create"
              onMouseDown={handleCreateNew}
            >
              Create &ldquo;{inputVal.trim()}&rdquo;
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

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
            <button
              type="button"
              className="step-btn"
              onClick={() => moveUp(i)}
              disabled={i === 0}
              aria-label="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              className="step-btn"
              onClick={() => moveDown(i)}
              disabled={i === steps.length - 1}
              aria-label="Move down"
            >
              ↓
            </button>
          </div>
          <span className="step-index">{i + 1}</span>
          <input
            type="text"
            className="step-input"
            value={step}
            onChange={e => updateStep(i, e.target.value)}
            placeholder={`Stage ${i + 1}`}
          />
          <button
            type="button"
            className="step-btn step-btn--remove"
            onClick={() => removeStep(i)}
            aria-label="Remove stage"
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="btn-ghost steps-add-btn" onClick={addStep}>
        + Add stage
      </button>
    </div>
  )
}

// ── Create Role form ──────────────────────────────────────

export default function CreateRole() {
  const { recruiter } = useRecruiter()
  const navigate      = useNavigate()

  const [clients, setClients] = useState([])

  // Form state
  const [title, setTitle]       = useState('')
  const [client, setClient]     = useState({ id: null, name: '', isNew: false })
  const [compMin, setCompMin]   = useState('')
  const [compMax, setCompMax]   = useState('')
  const [compType, setCompType] = useState('salary')
  const [steps, setSteps]       = useState(DEFAULT_STEPS)
  const [notes, setNotes]       = useState('')

  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)

  // Fetch existing clients for combobox
  useEffect(() => {
    if (!recruiter?.id) return
    supabase
      .from('clients')
      .select('id, name')
      .eq('recruiter_id', recruiter.id)
      .order('name')
      .then(({ data }) => setClients(data ?? []))
  }, [recruiter?.id])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError('Job title is required.')
      return
    }
    if (!client.id && !client.isNew) {
      setError('Please select or create a client.')
      return
    }
    if (client.isNew && !client.name.trim()) {
      setError('New client name cannot be empty.')
      return
    }
    if (steps.some(s => !s.trim())) {
      setError('All process stages must have a name.')
      return
    }

    setSaving(true)

    try {
      let clientId = client.id

      // Create new client if needed
      if (client.isNew) {
        const { data, error: clientErr } = await supabase
          .from('clients')
          .insert({ recruiter_id: recruiter.id, name: client.name.trim() })
          .select('id')
          .single()

        if (clientErr) throw new Error(`Failed to create client: ${clientErr.message}`)
        clientId = data.id
      }

      // Create role
      const { error: roleErr } = await supabase
        .from('roles')
        .insert({
          recruiter_id:  recruiter.id,
          client_id:     clientId,
          title:         title.trim(),
          comp_min:      compMin ? Number(compMin) : null,
          comp_max:      compMax ? Number(compMax) : null,
          comp_currency: 'USD',
          comp_type:     compType || null,
          process_steps: steps.filter(s => s.trim()),
          notes:         notes.trim() || null,
          status:        'open',
        })

      if (roleErr) throw new Error(`Failed to create role: ${roleErr.message}`)

      navigate('/roles')
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <AppLayout>
      <div className="form-page-header">
        <button className="btn-back" onClick={() => navigate('/roles')}>← Back</button>
        <h1 className="page-title">Create Role</h1>
      </div>

      <form className="role-form" onSubmit={handleSubmit} noValidate>

        {/* Job title */}
        <div className="form-field">
          <label className="form-label" htmlFor="title">Job Title <span className="required">*</span></label>
          <input
            id="title"
            type="text"
            className="field-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Senior Product Manager"
            autoFocus
          />
        </div>

        {/* Client */}
        <div className="form-field">
          <label className="form-label">Client <span className="required">*</span></label>
          <ClientCombobox
            clients={clients}
            value={client}
            onChange={setClient}
          />
        </div>

        {/* Compensation */}
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

        {/* Process steps */}
        <div className="form-field">
          <label className="form-label">Hiring Process</label>
          <p className="form-hint">Define and order the stages for this role.</p>
          <StepsBuilder steps={steps} onChange={setSteps} />
        </div>

        {/* Notes */}
        <div className="form-field">
          <label className="form-label" htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            className="field-input field-textarea"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Anything else relevant to this role…"
            rows={4}
          />
        </div>

        {error && <p className="error">{error}</p>}

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Role'}
          </button>
          <button type="button" className="btn-ghost" onClick={() => navigate('/roles')}>
            Cancel
          </button>
        </div>

      </form>
    </AppLayout>
  )
}
