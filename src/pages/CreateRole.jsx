import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useRecruiter } from '../hooks/useRecruiter'
import { supabase } from '../lib/supabase'
import { generateText } from '../lib/ai/index.js'
import { buildJdMessages, buildJdPdfMessages } from '../lib/prompts/jdExtractor.js'
import { buildBooleanSearchMessages } from '../lib/prompts/booleanSearchBuilder.js'
import { buildJobDescriptionMessages } from '../lib/prompts/jobDescriptionWriter.js'

async function fileToBase64(file) {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

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
  const [feeType, setFeeType]   = useState('pct')   // 'pct' | 'flat'
  const [feePct, setFeePct]     = useState('')
  const [feeFlat, setFeeFlat]   = useState('')

  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState(null)

  // JD writer
  const [jdWriter, setJdWriter] = useState({ phase: 'idle', result: '', error: '' })

  // JD importer
  const [jdText, setJdText]             = useState('')
  const [extracting, setExtracting]     = useState(false)
  const [pdfLoading, setPdfLoading]     = useState(false)
  const [extractError, setExtractError] = useState(null)
  const pdfInputRef                     = useRef(null)

  const VALID_COMP_TYPES = new Set(['salary', 'hourly', 'contract', 'equity_plus_salary'])

  async function handlePdfUpload(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setPdfLoading(true)
    setExtractError(null)
    try {
      const base64 = await fileToBase64(file)
      const text = await generateText({ messages: buildJdPdfMessages(base64), maxTokens: 4096 })
      setJdText(text)
    } catch {
      setExtractError('Could not extract text from PDF. Try pasting the text manually.')
    } finally {
      setPdfLoading(false)
    }
  }

  async function handleGenerateJD() {
    const source = notes.trim() || jdText.trim()
    if (!source) return
    setJdWriter({ phase: 'generating', result: '', error: '' })
    try {
      const roleContext = { title: title.trim() || null, clients: { name: client.name || null }, comp_min: compMin ? Number(compMin) : null, comp_max: compMax ? Number(compMax) : null, comp_type: compType || null }
      const result = await generateText({ messages: buildJobDescriptionMessages(source, roleContext), maxTokens: 2048 })
      setJdWriter({ phase: 'confirm', result, error: '' })
    } catch {
      setJdWriter({ phase: 'error', result: '', error: 'Could not generate job description. Try again.' })
    }
  }

  function confirmJD() {
    setNotes(jdWriter.result)
    setJdWriter({ phase: 'idle', result: '', error: '' })
  }

  async function handleExtract() {
    if (!jdText.trim()) return
    setExtracting(true)
    setExtractError(null)
    try {
      const raw = await generateText({ messages: buildJdMessages(jdText), maxTokens: 1024 })
      const extracted = JSON.parse(raw)

      if (extracted.title && !title.trim()) setTitle(extracted.title)
      if (extracted.comp_min != null && !compMin) setCompMin(String(extracted.comp_min))
      if (extracted.comp_max != null && !compMax) setCompMax(String(extracted.comp_max))
      if (extracted.comp_type && VALID_COMP_TYPES.has(extracted.comp_type)) setCompType(extracted.comp_type)
      if (extracted.notes) setNotes(extracted.notes)
    } catch {
      setExtractError('Could not extract role details. Check the text and try again.')
    } finally {
      setExtracting(false)
    }
  }

  // Default fee from recruiter settings
  useEffect(() => {
    if (recruiter?.default_placement_fee_pct != null && !feePct) {
      setFeePct(String(recruiter.default_placement_fee_pct * 100))
    }
  }, [recruiter?.default_placement_fee_pct])

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

      // Create role — get ID back for search string generation
      const rolePayload = {
        recruiter_id:       recruiter.id,
        client_id:          clientId,
        title:              title.trim(),
        comp_min:           compMin ? Number(compMin) : null,
        comp_max:           compMax ? Number(compMax) : null,
        comp_currency:      'USD',
        comp_type:          compType || null,
        process_steps:      steps.filter(s => s.trim()),
        notes:              notes.trim() || null,
        status:             'open',
        placement_fee_pct:  feeType === 'pct' && feePct ? Number(feePct) / 100 : null,
        placement_fee_flat: feeType === 'flat' && feeFlat ? Number(feeFlat) : null,
      }

      const { data: newRole, error: roleErr } = await supabase
        .from('roles')
        .insert(rolePayload)
        .select('id')
        .single()

      if (roleErr) throw new Error(`Failed to create role: ${roleErr.message}`)

      // Auto-generate search strings in background — doesn't block navigation
      if (newRole?.id && notes.trim()) {
        const roleForSearch = {
          ...rolePayload,
          id: newRole.id,
          clients: { name: client.name },
        }
        generateText({ messages: buildBooleanSearchMessages(roleForSearch), maxTokens: 1024 })
          .then(raw => {
            const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
            const result = JSON.parse(cleaned)
            return supabase.from('roles').update({ search_strings: result }).eq('id', newRole.id)
          })
          .catch(err => console.warn('Auto search string generation failed:', err.message))
      }

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

        {/* JD importer */}
        <div className="jd-importer">
          <div className="jd-importer-header">
            <h2 className="jd-importer-title">Import Job Description</h2>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => pdfInputRef.current?.click()}
              disabled={pdfLoading || extracting}
            >
              {pdfLoading ? 'Reading PDF…' : '↑ Upload PDF'}
            </button>
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={handlePdfUpload}
            />
          </div>
          <textarea
            className="field-input field-textarea jd-textarea"
            value={jdText}
            onChange={e => setJdText(e.target.value)}
            placeholder="Paste a job description, intake notes, or anything you have. No specific format required."
            rows={6}
          />
          {extractError && <p className="error">{extractError}</p>}
          <button
            type="button"
            className="btn-ghost"
            onClick={handleExtract}
            disabled={extracting || pdfLoading || !jdText.trim()}
          >
            {extracting ? 'Extracting…' : 'Extract Role Details'}
          </button>
        </div>

        <hr className="form-divider" />

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

        {/* Placement fee */}
        <div className="form-field">
          <label className="form-label">Placement Fee</label>
          <div className="fee-toggle">
            <button
              type="button"
              className={`fee-toggle-btn${feeType === 'pct' ? ' fee-toggle-btn--active' : ''}`}
              onClick={() => setFeeType('pct')}
            >
              % of comp
            </button>
            <button
              type="button"
              className={`fee-toggle-btn${feeType === 'flat' ? ' fee-toggle-btn--active' : ''}`}
              onClick={() => setFeeType('flat')}
            >
              Flat fee
            </button>
          </div>
          {feeType === 'pct' ? (
            <div className="comp-input-wrap" style={{ marginTop: 8 }}>
              <input
                type="number"
                className="field-input comp-input"
                value={feePct}
                onChange={e => setFeePct(e.target.value)}
                placeholder="e.g. 20"
                min="0"
                max="100"
              />
              <span style={{ marginLeft: 8, color: 'var(--color-muted)', fontSize: 14 }}>%</span>
            </div>
          ) : (
            <div className="comp-input-wrap" style={{ marginTop: 8 }}>
              <span className="comp-prefix">$</span>
              <input
                type="number"
                className="field-input comp-input"
                value={feeFlat}
                onChange={e => setFeeFlat(e.target.value)}
                placeholder="Flat fee in dollars"
                min="0"
              />
            </div>
          )}
        </div>

        {/* Process steps */}
        <div className="form-field">
          <label className="form-label">Hiring Process</label>
          <p className="form-hint">Define and order the stages for this role.</p>
          <StepsBuilder steps={steps} onChange={setSteps} />
        </div>

        {/* Notes */}
        <div className="form-field">
          <div className="jd-notes-header">
            <label className="form-label" htmlFor="notes">Notes</label>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={handleGenerateJD}
              disabled={jdWriter.phase === 'generating' || (!notes.trim() && !jdText.trim())}
            >
              {jdWriter.phase === 'generating' ? 'Generating…' : 'Generate JD'}
            </button>
          </div>
          <textarea
            id="notes"
            className="field-input field-textarea"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Anything else relevant to this role…"
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
