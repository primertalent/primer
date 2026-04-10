import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useRecruiter } from '../hooks/useRecruiter'
import { supabase } from '../lib/supabase'

// ── Helpers ───────────────────────────────────────────────

const STATUS_LABELS = {
  open:      'Open',
  on_hold:   'On Hold',
  filled:    'Filled',
  cancelled: 'Cancelled',
}

const COMP_TYPE_SUFFIXES = {
  salary:             '/yr',
  hourly:             '/hr',
  contract:           '/yr',
  equity_plus_salary: '/yr + equity',
}

function formatComp(min, max, type) {
  if (!min && !max) return null
  const fmt = n => `$${Number(n).toLocaleString()}`
  const range = (min && max)
    ? `${fmt(min)} – ${fmt(max)}`
    : min ? `${fmt(min)}+` : `Up to ${fmt(max)}`
  return `${range}${COMP_TYPE_SUFFIXES[type] ?? ''}`
}

// ── Contact card ──────────────────────────────────────────

function ContactCard({ contact }) {
  return (
    <div className="contact-card">
      <div className="contact-card-header">
        <div className="contact-card-identity">
          <span className="contact-name">{contact.full_name}</span>
          {contact.title && <span className="contact-title">{contact.title}</span>}
        </div>
        {contact.is_primary && (
          <span className="contact-primary-badge">Primary</span>
        )}
      </div>
      <div className="contact-details">
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="contact-link">{contact.email}</a>
        )}
        {contact.phone && (
          <span className="contact-detail">{contact.phone}</span>
        )}
        {contact.linkedin_url && (
          <a href={contact.linkedin_url} target="_blank" rel="noreferrer" className="contact-link">
            LinkedIn ↗
          </a>
        )}
      </div>
    </div>
  )
}

// ── Add contact form ──────────────────────────────────────

function AddContactForm({ clientId, recruiterId, onAdded, onCancel }) {
  const [fullName, setFullName]       = useState('')
  const [title, setTitle]             = useState('')
  const [email, setEmail]             = useState('')
  const [phone, setPhone]             = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [isPrimary, setIsPrimary]     = useState(false)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!fullName.trim()) { setError('Name is required.'); return }
    setSaving(true)

    const { data, error: err } = await supabase
      .from('client_contacts')
      .insert({
        client_id:    clientId,
        recruiter_id: recruiterId,
        full_name:    fullName.trim(),
        title:        title.trim() || null,
        email:        email.trim() || null,
        phone:        phone.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
        is_primary:   isPrimary,
      })
      .select('*')
      .single()

    if (err) { setError(err.message); setSaving(false); return }
    onAdded(data)
  }

  return (
    <form className="add-contact-form" onSubmit={handleSubmit} noValidate>
      <div className="form-two-col">
        <div className="form-field">
          <label className="form-label">Name <span className="required">*</span></label>
          <input type="text" className="field-input" value={fullName} onChange={e => setFullName(e.target.value)} autoFocus />
        </div>
        <div className="form-field">
          <label className="form-label">Title</label>
          <input type="text" className="field-input" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
      </div>
      <div className="form-two-col">
        <div className="form-field">
          <label className="form-label">Email</label>
          <input type="email" className="field-input" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="form-field">
          <label className="form-label">Phone</label>
          <input type="tel" className="field-input" value={phone} onChange={e => setPhone(e.target.value)} />
        </div>
      </div>
      <div className="form-field">
        <label className="form-label">LinkedIn URL</label>
        <input type="url" className="field-input" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} />
      </div>
      <label className="contact-toggle-label">
        <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} />
        <span>Primary contact</span>
      </label>
      {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Add Contact'}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

// ── Main page ─────────────────────────────────────────────

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { recruiter } = useRecruiter()

  const [client, setClient]     = useState(null)
  const [contacts, setContacts] = useState([])
  const [roles, setRoles]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Inline edit
  const [editing, setEditing]         = useState(false)
  const [editName, setEditName]       = useState('')
  const [editWebsite, setEditWebsite] = useState('')
  const [editIndustry, setEditIndustry] = useState('')
  const [editSaving, setEditSaving]   = useState(false)
  const [editError, setEditError]     = useState(null)

  // Notes
  const [notes, setNotes]           = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

  // Contact add
  const [addingContact, setAddingContact] = useState(false)

  useEffect(() => {
    if (!id || !recruiter?.id) return

    async function fetchAll() {
      const [clientRes, contactsRes, rolesRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name, website, industry, notes')
          .eq('id', id)
          .eq('recruiter_id', recruiter.id)
          .single(),

        supabase
          .from('client_contacts')
          .select('*')
          .eq('client_id', id)
          .order('is_primary', { ascending: false })
          .order('full_name'),

        supabase
          .from('roles')
          .select('id, title, status, comp_min, comp_max, comp_type, pipeline(id)')
          .eq('client_id', id)
          .eq('recruiter_id', recruiter.id)
          .order('created_at', { ascending: false }),
      ])

      if (clientRes.error || !clientRes.data) {
        setNotFound(true)
      } else {
        setClient(clientRes.data)
        setNotes(clientRes.data.notes ?? '')
        setContacts(contactsRes.data ?? [])
        setRoles(rolesRes.data ?? [])
      }
      setLoading(false)
    }

    fetchAll()
  }, [id, recruiter?.id])

  function startEditing() {
    setEditName(client.name)
    setEditWebsite(client.website ?? '')
    setEditIndustry(client.industry ?? '')
    setEditError(null)
    setEditing(true)
  }

  async function handleSaveEdit() {
    if (!editName.trim()) { setEditError('Name is required.'); return }
    setEditSaving(true)
    const { error } = await supabase
      .from('clients')
      .update({
        name:     editName.trim(),
        website:  editWebsite.trim() || null,
        industry: editIndustry.trim() || null,
      })
      .eq('id', id)
      .eq('recruiter_id', recruiter.id)

    if (error) { setEditError(error.message); setEditSaving(false); return }
    setClient(prev => ({
      ...prev,
      name:     editName.trim(),
      website:  editWebsite.trim() || null,
      industry: editIndustry.trim() || null,
    }))
    setEditing(false)
    setEditSaving(false)
  }

  async function handleSaveNotes() {
    setNotesSaving(true)
    setNotesSaved(false)
    await supabase
      .from('clients')
      .update({ notes })
      .eq('id', id)
      .eq('recruiter_id', recruiter.id)
    setNotesSaving(false)
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2500)
  }

  function handleContactAdded(contact) {
    setContacts(prev =>
      [contact, ...prev].sort((a, b) =>
        Number(b.is_primary) - Number(a.is_primary) || a.full_name.localeCompare(b.full_name)
      )
    )
    setAddingContact(false)
  }

  if (loading) return <AppLayout><p className="muted">Loading…</p></AppLayout>

  if (notFound) return (
    <AppLayout>
      <p className="muted">Client not found.</p>
      <button className="btn-ghost" style={{ marginTop: 16 }} onClick={() => navigate('/clients')}>
        Go back
      </button>
    </AppLayout>
  )

  return (
    <AppLayout>

      {/* Header */}
      <div className="client-detail-header">
        <div className="client-detail-header-left">
          <button className="btn-back" onClick={() => navigate('/clients')}>← Back</button>

          {editing ? (
            <div className="client-edit-form">
              <div className="client-edit-fields">
                <input
                  type="text"
                  className="field-input"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Company name"
                  autoFocus
                />
                <input
                  type="url"
                  className="field-input"
                  value={editWebsite}
                  onChange={e => setEditWebsite(e.target.value)}
                  placeholder="Website"
                />
                <input
                  type="text"
                  className="field-input"
                  value={editIndustry}
                  onChange={e => setEditIndustry(e.target.value)}
                  placeholder="Industry"
                />
              </div>
              {editError && <p className="error" style={{ marginTop: 6 }}>{editError}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="btn-primary" onClick={handleSaveEdit} disabled={editSaving}>
                  {editSaving ? 'Saving…' : 'Save'}
                </button>
                <button className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="page-title">{client.name}</h1>
              {(client.website || client.industry) && (
                <p className="page-subtitle">
                  {client.website && (
                    <a
                      href={client.website}
                      target="_blank"
                      rel="noreferrer"
                      className="client-website-link"
                    >
                      {client.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                  {client.website && client.industry && ' · '}
                  {client.industry}
                </p>
              )}
            </div>
          )}
        </div>

        {!editing && (
          <button className="btn-ghost" onClick={startEditing}>Edit</button>
        )}
      </div>

      {/* Two-column: contacts + roles */}
      <div className="candidate-columns">

        {/* Left: Key Contacts */}
        <section className="candidate-section">
          <div className="section-heading-row">
            <h2 className="section-heading">Key Contacts</h2>
            <button
              className="btn-ghost btn-sm"
              onClick={() => setAddingContact(prev => !prev)}
            >
              {addingContact ? 'Cancel' : '+ Add Contact'}
            </button>
          </div>

          {addingContact && (
            <AddContactForm
              clientId={id}
              recruiterId={recruiter.id}
              onAdded={handleContactAdded}
              onCancel={() => setAddingContact(false)}
            />
          )}

          {contacts.length === 0 && !addingContact ? (
            <p className="muted">No contacts yet.</p>
          ) : (
            contacts.map(c => <ContactCard key={c.id} contact={c} />)
          )}
        </section>

        {/* Right: Roles */}
        <section className="candidate-section">
          <h2 className="section-heading">Roles</h2>
          {roles.length === 0 ? (
            <p className="muted">No roles yet.</p>
          ) : (
            roles.map(role => {
              const comp = formatComp(role.comp_min, role.comp_max, role.comp_type)
              const candidateCount = (role.pipeline ?? []).length
              return (
                <Link key={role.id} to={`/roles/${role.id}`} className="client-role-row">
                  <div className="client-role-row-main">
                    <span className="client-role-title">{role.title}</span>
                    <div className="client-role-meta">
                      {comp && <span className="role-comp">{comp}</span>}
                      <span className="client-role-candidates">
                        {candidateCount} {candidateCount === 1 ? 'candidate' : 'candidates'}
                      </span>
                    </div>
                  </div>
                  <span className={`role-status-badge role-status-badge--${role.status}`}>
                    {STATUS_LABELS[role.status] ?? role.status}
                  </span>
                </Link>
              )
            })
          )}
        </section>

      </div>

      {/* Notes */}
      <section className="candidate-section" style={{ marginTop: 24 }}>
        <h2 className="section-heading">Client Notes</h2>
        <textarea
          className="field-input field-textarea"
          value={notes}
          onChange={e => { setNotes(e.target.value); setNotesSaved(false) }}
          rows={4}
          placeholder="Notes about this client…"
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
          <button className="btn-primary" onClick={handleSaveNotes} disabled={notesSaving}>
            {notesSaving ? 'Saving…' : 'Save Notes'}
          </button>
          {notesSaved && <span className="notes-saved-label">Saved</span>}
        </div>
      </section>

    </AppLayout>
  )
}
