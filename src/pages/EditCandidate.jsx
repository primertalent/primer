import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useRecruiter } from '../hooks/useRecruiter'
import { supabase } from '../lib/supabase'

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

export default function EditCandidate() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const { recruiter } = useRecruiter()

  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)

  const [firstName, setFirstName]           = useState('')
  const [lastName, setLastName]             = useState('')
  const [email, setEmail]                   = useState('')
  const [phone, setPhone]                   = useState('')
  const [linkedinUrl, setLinkedinUrl]       = useState('')
  const [currentTitle, setCurrentTitle]     = useState('')
  const [currentCompany, setCurrentCompany] = useState('')
  const [location, setLocation]             = useState('')
  const [source, setSource]                 = useState('inbound')
  const [skills, setSkills]                 = useState([])
  const [notes, setNotes]                   = useState('')
  const [cvText, setCvText]                 = useState('')

  useEffect(() => {
    if (!id || !recruiter?.id) return
    supabase
      .from('candidates')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setNotFound(true)
        } else {
          setFirstName(data.first_name ?? '')
          setLastName(data.last_name ?? '')
          setEmail(data.email ?? '')
          setPhone(data.phone ?? '')
          setLinkedinUrl(data.linkedin_url ?? '')
          setCurrentTitle(data.current_title ?? '')
          setCurrentCompany(data.current_company ?? '')
          setLocation(data.location ?? '')
          setSource(data.source ?? 'inbound')
          setSkills(data.skills ?? [])
          setNotes(data.notes ?? '')
          setCvText(data.cv_text ?? '')
        }
        setLoading(false)
      })
  }, [id, recruiter?.id])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required.')
      return
    }

    setSaving(true)

    const { error: updateErr } = await supabase
      .from('candidates')
      .update({
        first_name:      firstName.trim(),
        last_name:       lastName.trim(),
        email:           email.trim() || null,
        phone:           phone.trim() || null,
        linkedin_url:    linkedinUrl.trim() || null,
        current_title:   currentTitle.trim() || null,
        current_company: currentCompany.trim() || null,
        location:        location.trim() || null,
        source,
        skills,
        notes:           notes.trim() || null,
        cv_text:         cvText.trim() || null,
      })
      .eq('id', id)

    if (updateErr) {
      setError(updateErr.message)
      setSaving(false)
    } else {
      navigate(`/candidates/${id}`)
    }
  }

  if (loading) return <AppLayout><p className="muted">Loading…</p></AppLayout>

  if (notFound) {
    return (
      <AppLayout>
        <p className="muted">Candidate not found.</p>
        <button className="btn-ghost" style={{ marginTop: 16 }} onClick={() => navigate(-1)}>Go back</button>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="form-page-header">
        <button className="btn-back" onClick={() => navigate(`/candidates/${id}`)}>← Back</button>
        <h1 className="page-title">Edit Candidate</h1>
      </div>

      <form className="role-form" onSubmit={handleSubmit} noValidate>

        <div className="form-two-col">
          <div className="form-field">
            <label className="form-label" htmlFor="firstName">First Name <span className="required">*</span></label>
            <input id="firstName" type="text" className="field-input" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane" />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="lastName">Last Name <span className="required">*</span></label>
            <input id="lastName" type="text" className="field-input" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" />
          </div>
        </div>

        <div className="form-two-col">
          <div className="form-field">
            <label className="form-label" htmlFor="email">Email</label>
            <input id="email" type="email" className="field-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="phone">Phone</label>
            <input id="phone" type="tel" className="field-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555 000 0000" />
          </div>
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="linkedinUrl">LinkedIn URL</label>
          <input id="linkedinUrl" type="url" className="field-input" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/janesmith" />
        </div>

        <div className="form-two-col">
          <div className="form-field">
            <label className="form-label" htmlFor="currentTitle">Current Title</label>
            <input id="currentTitle" type="text" className="field-input" value={currentTitle} onChange={e => setCurrentTitle(e.target.value)} placeholder="Senior Engineer" />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="currentCompany">Current Company</label>
            <input id="currentCompany" type="text" className="field-input" value={currentCompany} onChange={e => setCurrentCompany(e.target.value)} placeholder="Acme Corp" />
          </div>
        </div>

        <div className="form-two-col">
          <div className="form-field">
            <label className="form-label" htmlFor="location">Location</label>
            <input id="location" type="text" className="field-input" value={location} onChange={e => setLocation(e.target.value)} placeholder="San Francisco, CA" />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="source">Source</label>
            <select id="source" className="field-input" value={source} onChange={e => setSource(e.target.value)}>
              <option value="inbound">Inbound</option>
              <option value="sourced">Sourced</option>
              <option value="referral">Referral</option>
              <option value="job_board">Job Board</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="form-field">
          <label className="form-label">Skills</label>
          <p className="form-hint">Press Enter or comma to add. Backspace to remove.</p>
          <SkillsInput skills={skills} onChange={setSkills} />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="notes">Notes</label>
          <textarea id="notes" className="field-input field-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional context…" rows={3} />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="cvText">CV Text</label>
          <p className="form-hint">Full resume text — used by AI tools for screening and next action suggestions.</p>
          <textarea id="cvText" className="field-input field-textarea" value={cvText} onChange={e => setCvText(e.target.value)} placeholder="Paste the full CV text here…" rows={12} />
        </div>

        {error && <p className="error">{error}</p>}

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button type="button" className="btn-ghost" onClick={() => navigate(`/candidates/${id}`)}>
            Cancel
          </button>
        </div>

      </form>
    </AppLayout>
  )
}
