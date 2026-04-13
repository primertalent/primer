import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import mammoth from 'mammoth'
import AppLayout from '../components/AppLayout'
import { useRecruiter } from '../hooks/useRecruiter'
import { supabase } from '../lib/supabase'
import { generateText } from '../lib/ai'
import { buildCvPdfMessages, buildCvTextMessages } from '../lib/prompts/cvExtraction'

const ACCEPTED_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
}

// ── File reading helpers ──────────────────────────────────

async function fileToBase64(file) {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

async function extractTextFromDocx(file) {
  const buffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  return result.value
}

// ── CV extraction via AI service ─────────────────────────

async function extractFromPdf(file) {
  const base64 = await fileToBase64(file)
  return generateText({ messages: buildCvPdfMessages(base64) })
}

async function extractFromDocx(file) {
  const text = await extractTextFromDocx(file)
  return generateText({ messages: buildCvTextMessages(text) })
}

function parseExtraction(raw) {
  try {
    // Strip markdown code fences if Claude wrapped the JSON
    const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

// ── Upload drop zone ──────────────────────────────────────

function DropZone({ onFile, extracting }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && ACCEPTED_TYPES[file.type]) onFile(file)
  }

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (file) onFile(file)
    e.target.value = ''
  }

  return (
    <div
      className={`drop-zone${dragging ? ' drop-zone--dragging' : ''}${extracting ? ' drop-zone--processing' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !extracting && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      {extracting ? (
        <div className="drop-zone-content">
          <div className="drop-spinner" />
          <p className="drop-label">Extracting candidate information…</p>
        </div>
      ) : (
        <div className="drop-zone-content">
          <div className="drop-icon">↑</div>
          <p className="drop-label">Drop a CV here, or click to browse</p>
          <p className="drop-hint">PDF or Word document</p>
        </div>
      )}
    </div>
  )
}

// ── Skills input ──────────────────────────────────────────

function SkillsInput({ skills, onChange }) {
  const [inputVal, setInputVal] = useState('')

  function addSkill(raw) {
    const incoming = raw.split(',').map(s => s.trim()).filter(Boolean)
    const merged = [...new Set([...skills, ...incoming])]
    onChange(merged)
    setInputVal('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (inputVal.trim()) addSkill(inputVal)
    }
    if (e.key === 'Backspace' && !inputVal && skills.length) {
      onChange(skills.slice(0, -1))
    }
  }

  function removeSkill(i) {
    onChange(skills.filter((_, idx) => idx !== i))
  }

  return (
    <div className="skills-input">
      {skills.map((skill, i) => (
        <span key={i} className="skill-tag">
          {skill}
          <button
            type="button"
            className="skill-remove"
            onClick={() => removeSkill(i)}
            aria-label={`Remove ${skill}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        className="skills-text-input"
        value={inputVal}
        onChange={e => setInputVal(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (inputVal.trim()) addSkill(inputVal) }}
        placeholder={skills.length ? '' : 'Type a skill and press Enter…'}
      />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────

export default function CreateCandidate() {
  const { recruiter } = useRecruiter()
  const navigate      = useNavigate()

  const [roles, setRoles]         = useState([])
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState(null)
  const [uploadedFile, setUploadedFile] = useState(null)

  // Form fields
  const [firstName, setFirstName]         = useState('')
  const [lastName, setLastName]           = useState('')
  const [email, setEmail]                 = useState('')
  const [phone, setPhone]                 = useState('')
  const [currentTitle, setCurrentTitle]   = useState('')
  const [currentCompany, setCurrentCompany] = useState('')
  const [location, setLocation]           = useState('')
  const [skills, setSkills]               = useState([])
  const [source, setSource]               = useState('inbound')
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [notes, setNotes]                 = useState('')
  const [cvText, setCvText]               = useState('')

  const [saving, setSaving]   = useState(false)
  const [formError, setFormError] = useState(null)

  // Fetch roles for the dropdown
  useEffect(() => {
    if (!recruiter?.id) return
    supabase
      .from('roles')
      .select('id, title, process_steps, clients(name)')
      .eq('recruiter_id', recruiter.id)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .then(({ data }) => setRoles(data ?? []))
  }, [recruiter?.id])

  async function handleFile(file) {
    setUploadedFile(file)
    setExtractError(null)
    setExtracting(true)

    try {
      let rawJson
      const fileType = ACCEPTED_TYPES[file.type]

      if (fileType === 'pdf') {
        rawJson = await extractFromPdf(file)
      } else {
        // docx / doc
        rawJson = await extractFromDocx(file)
        // Also store text for the cv_text field
        const text = await extractTextFromDocx(file)
        setCvText(text)
      }

      const parsed = parseExtraction(rawJson)

      if (!parsed) {
        setExtractError('Could not parse the extracted data. Please fill in the form manually.')
      } else {
        if (parsed.first_name)    setFirstName(parsed.first_name)
        if (parsed.last_name)     setLastName(parsed.last_name)
        if (parsed.email)         setEmail(parsed.email)
        if (parsed.phone)         setPhone(parsed.phone)
        if (parsed.current_title) setCurrentTitle(parsed.current_title)
        if (parsed.current_company) setCurrentCompany(parsed.current_company)
        if (parsed.location)      setLocation(parsed.location)
        if (Array.isArray(parsed.skills)) setSkills(parsed.skills)
        setSource('inbound')
      }
    } catch (err) {
      setExtractError(`Extraction failed: ${err.message}`)
    } finally {
      setExtracting(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)

    if (!firstName.trim() || !lastName.trim()) {
      setFormError('First name and last name are required.')
      return
    }

    setSaving(true)

    try {
      // Insert candidate
      const { data: candidate, error: candidateErr } = await supabase
        .from('candidates')
        .insert({
          recruiter_id:    recruiter.id,
          first_name:      firstName.trim(),
          last_name:       lastName.trim(),
          email:           email.trim() || null,
          phone:           phone.trim() || null,
          current_title:   currentTitle.trim() || null,
          current_company: currentCompany.trim() || null,
          location:        location.trim() || null,
          skills,
          source,
          cv_text:         cvText || null,
          notes:           notes.trim() || null,
        })
        .select('id')
        .single()

      if (candidateErr) throw new Error(candidateErr.message)

      // Create pipeline entry if a role was selected
      if (selectedRoleId) {
        const role = roles.find(r => r.id === selectedRoleId)
        const firstStage = role?.process_steps?.[0] ?? 'Sourced'

        const { error: pipelineErr } = await supabase
          .from('pipeline')
          .insert({
            recruiter_id:  recruiter.id,
            candidate_id:  candidate.id,
            role_id:       selectedRoleId,
            current_stage: firstStage,
            status:        'active',
          })

        if (pipelineErr) throw new Error(pipelineErr.message)
      }

      navigate(`/candidates/${candidate.id}`)
    } catch (err) {
      setFormError(err.message)
      setSaving(false)
    }
  }

  return (
    <AppLayout>
      <div className="form-page-header">
        <button className="btn-back" onClick={() => navigate(-1)}>← Back</button>
        <h1 className="page-title">New Candidate</h1>
      </div>

      {/* CV Upload */}
      <section className="upload-section">
        <div className="upload-section-header">
          <h2 className="section-heading-lg">Upload CV</h2>
          <p className="upload-hint">
            Wren will extract candidate information automatically.
          </p>
        </div>
        <DropZone onFile={handleFile} extracting={extracting} />
        {uploadedFile && !extracting && (
          <p className="upload-filename">
            {extractError ? '⚠ ' : '✓ '}{uploadedFile.name}
          </p>
        )}
        {extractError && <p className="error" style={{ marginTop: 8 }}>{extractError}</p>}
      </section>

      <div className="upload-divider">
        <span>or enter manually</span>
      </div>

      {/* Candidate form */}
      <form className="role-form" onSubmit={handleSubmit} noValidate>

        <div className="form-two-col">
          <div className="form-field">
            <label className="form-label" htmlFor="firstName">
              First Name <span className="required">*</span>
            </label>
            <input
              id="firstName"
              type="text"
              className="field-input"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="Jane"
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="lastName">
              Last Name <span className="required">*</span>
            </label>
            <input
              id="lastName"
              type="text"
              className="field-input"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="Smith"
            />
          </div>
        </div>

        <div className="form-two-col">
          <div className="form-field">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="field-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="phone">Phone</label>
            <input
              id="phone"
              type="tel"
              className="field-input"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+1 555 000 0000"
            />
          </div>
        </div>

        <div className="form-two-col">
          <div className="form-field">
            <label className="form-label" htmlFor="currentTitle">Current Title</label>
            <input
              id="currentTitle"
              type="text"
              className="field-input"
              value={currentTitle}
              onChange={e => setCurrentTitle(e.target.value)}
              placeholder="Senior Engineer"
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="currentCompany">Current Company</label>
            <input
              id="currentCompany"
              type="text"
              className="field-input"
              value={currentCompany}
              onChange={e => setCurrentCompany(e.target.value)}
              placeholder="Acme Corp"
            />
          </div>
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="location">Location</label>
          <input
            id="location"
            type="text"
            className="field-input"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="San Francisco, CA"
          />
        </div>

        <div className="form-field">
          <label className="form-label">Skills</label>
          <p className="form-hint">Press Enter or comma to add. Backspace to remove.</p>
          <SkillsInput skills={skills} onChange={setSkills} />
        </div>

        <div className="form-two-col">
          <div className="form-field">
            <label className="form-label" htmlFor="source">Source</label>
            <select
              id="source"
              className="field-input"
              value={source}
              onChange={e => setSource(e.target.value)}
            >
              <option value="inbound">Inbound</option>
              <option value="sourced">Sourced</option>
              <option value="referral">Referral</option>
              <option value="job_board">Job Board</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="role">Add to Role</label>
            <select
              id="role"
              className="field-input"
              value={selectedRoleId}
              onChange={e => setSelectedRoleId(e.target.value)}
            >
              <option value="">None</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>
                  {r.title}{r.clients?.name ? ` — ${r.clients.name}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            className="field-input field-textarea"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any additional context…"
            rows={3}
          />
        </div>

        {formError && <p className="error">{formError}</p>}

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={saving || extracting}>
            {saving ? 'Saving…' : 'Save Candidate'}
          </button>
          <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>
            Cancel
          </button>
        </div>

      </form>
    </AppLayout>
  )
}
