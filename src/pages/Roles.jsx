import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useRecruiter } from '../hooks/useRecruiter'
import { supabase } from '../lib/supabase'

const STATUS_LABELS = {
  open:      'Open',
  on_hold:   'On Hold',
  filled:    'Filled',
  cancelled: 'Cancelled',
}

const COMP_TYPE_SUFFIXES = {
  salary:            '/yr',
  hourly:            '/hr',
  contract:          '/yr',
  equity_plus_salary: '/yr + equity',
}

function formatComp(min, max, type) {
  if (!min && !max) return null
  const fmt = n => `$${Number(n).toLocaleString()}`
  const range = (min && max)
    ? `${fmt(min)} – ${fmt(max)}`
    : min
      ? `${fmt(min)}+`
      : `Up to ${fmt(max)}`
  const suffix = COMP_TYPE_SUFFIXES[type] ?? ''
  return `${range}${suffix}`
}

function RoleCard({ role }) {
  const clientName     = role.clients?.name ?? '—'
  const comp           = formatComp(role.comp_min, role.comp_max, role.comp_type)
  const activePipeline = (role.pipeline ?? []).filter(p => p.status === 'active').length

  return (
    <div className="role-card">
      <div className="role-card-header">
        <div>
          <h2 className="role-title">{role.title}</h2>
          <p className="role-client">{clientName}</p>
        </div>
        <span className={`role-status-badge role-status-badge--${role.status}`}>
          {STATUS_LABELS[role.status] ?? role.status}
        </span>
      </div>

      <div className="role-card-footer">
        <div className="role-meta">
          {comp && <span className="role-comp">{comp}</span>}
        </div>
        <span className="role-pipeline-count">
          {activePipeline} {activePipeline === 1 ? 'candidate' : 'candidates'} in pipeline
        </span>
      </div>
    </div>
  )
}

export default function Roles() {
  const { recruiter }       = useRecruiter()
  const navigate            = useNavigate()
  const [roles, setRoles]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!recruiter?.id) return

    async function fetchRoles() {
      const { data, error } = await supabase
        .from('roles')
        .select(`
          *,
          clients ( name ),
          pipeline ( id, status )
        `)
        .eq('recruiter_id', recruiter.id)
        .order('created_at', { ascending: false })

      if (!error) setRoles(data ?? [])
      setLoading(false)
    }

    fetchRoles()
  }, [recruiter?.id])

  return (
    <AppLayout>
      <div className="roles-header">
        <div>
          <h1 className="brief-headline">Roles</h1>
          <p className="brief-date">Open positions you are working</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/roles/new')}>
          Create Role
        </button>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : roles.length === 0 ? (
        <div className="empty-state">
          <p className="muted">No roles yet. Create your first role to get started.</p>
        </div>
      ) : (
        <div className="roles-list">
          {roles.map(role => (
            <RoleCard key={role.id} role={role} />
          ))}
        </div>
      )}
    </AppLayout>
  )
}
