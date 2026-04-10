import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useRecruiter } from '../hooks/useRecruiter'
import { supabase } from '../lib/supabase'

// ── New client inline form ────────────────────────────────

function NewClientForm({ recruiterId, onCreated, onCancel }) {
  const [name, setName]         = useState('')
  const [website, setWebsite]   = useState('')
  const [industry, setIndustry] = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Client name is required.'); return }
    setSaving(true)
    const { data, error: err } = await supabase
      .from('clients')
      .insert({
        recruiter_id: recruiterId,
        name:         name.trim(),
        website:      website.trim() || null,
        industry:     industry.trim() || null,
      })
      .select('id, name, industry, website, roles(id, status), client_contacts(id)')
      .single()

    if (err) { setError(err.message); setSaving(false); return }
    onCreated(data)
  }

  return (
    <form className="new-client-form" onSubmit={handleSubmit} noValidate>
      <div className="new-client-fields">
        <input
          type="text"
          className="field-input"
          placeholder="Company name *"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
        <input
          type="url"
          className="field-input"
          placeholder="Website (optional)"
          value={website}
          onChange={e => setWebsite(e.target.value)}
        />
        <input
          type="text"
          className="field-input"
          placeholder="Industry (optional)"
          value={industry}
          onChange={e => setIndustry(e.target.value)}
        />
      </div>
      {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
      <div className="form-actions" style={{ marginTop: 12 }}>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Create Client'}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

// ── Client card ───────────────────────────────────────────

function ClientCard({ client }) {
  const openRoles = (client.roles ?? []).filter(r => r.status === 'open').length
  const contacts  = (client.client_contacts ?? []).length

  return (
    <Link to={`/clients/${client.id}`} className="client-card">
      <div className="client-card-header">
        <span className="client-card-name">{client.name}</span>
        {client.industry && (
          <span className="client-industry-tag">{client.industry}</span>
        )}
      </div>
      <div className="client-card-meta">
        <span className="client-meta-item">
          {openRoles} open {openRoles === 1 ? 'role' : 'roles'}
        </span>
        <span className="client-meta-sep">·</span>
        <span className="client-meta-item">
          {contacts} {contacts === 1 ? 'contact' : 'contacts'}
        </span>
      </div>
    </Link>
  )
}

// ── Main page ─────────────────────────────────────────────

export default function Clients() {
  const { recruiter } = useRecruiter()

  const [clients, setClients]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    if (!recruiter?.id) return
    supabase
      .from('clients')
      .select('id, name, industry, website, roles(id, status), client_contacts(id)')
      .eq('recruiter_id', recruiter.id)
      .order('name')
      .then(({ data }) => { setClients(data ?? []); setLoading(false) })
  }, [recruiter?.id])

  function handleCreated(client) {
    setClients(prev =>
      [...prev, client].sort((a, b) => a.name.localeCompare(b.name))
    )
    setShowForm(false)
  }

  return (
    <AppLayout>
      <div className="roles-header">
        <div>
          <h1 className="brief-headline">Clients</h1>
          <p className="brief-date">
            {loading ? 'Loading…' : `${clients.length} ${clients.length === 1 ? 'client' : 'clients'}`}
          </p>
        </div>
        {!showForm && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            New Client
          </button>
        )}
      </div>

      {showForm && (
        <div className="new-client-form-wrap">
          <NewClientForm
            recruiterId={recruiter.id}
            onCreated={handleCreated}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : clients.length === 0 && !showForm ? (
        <div className="empty-state">
          <p className="muted" style={{ marginBottom: 16 }}>No clients yet.</p>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            Add your first client
          </button>
        </div>
      ) : (
        <div className="roles-list">
          {clients.map(c => <ClientCard key={c.id} client={c} />)}
        </div>
      )}
    </AppLayout>
  )
}
