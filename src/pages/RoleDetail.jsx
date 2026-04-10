import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useRecruiter } from '../hooks/useRecruiter'
import { supabase } from '../lib/supabase'

// ── Helpers ───────────────────────────────────────────────

const STATUS_LABELS = {
  open:              'Open',
  on_hold:           'On Hold',
  filled:            'Filled',
  cancelled:         'Cancelled',
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
    : min
      ? `${fmt(min)}+`
      : `Up to ${fmt(max)}`
  return `${range}${COMP_TYPE_SUFFIXES[type] ?? ''}`
}

// ── Sub-components ────────────────────────────────────────

function PipelineCandidate({ entry }) {
  return (
    <Link to={`/candidates/${entry.candidate_id}`} className="pipeline-candidate-card">
      <span className="pipeline-candidate-name">
        {entry.candidates.first_name} {entry.candidates.last_name}
      </span>
      {entry.candidates.current_title && (
        <span className="pipeline-candidate-title">{entry.candidates.current_title}</span>
      )}
      {entry.fit_score != null && (
        <span className="pipeline-candidate-fit">
          {Math.round(entry.fit_score)}<span className="fit-denom">/100</span>
        </span>
      )}
    </Link>
  )
}

function PipelineColumn({ stage, entries }) {
  return (
    <div className="pipeline-column">
      <div className="pipeline-col-header">
        <span className="pipeline-col-name">{stage}</span>
        <span className="pipeline-col-count">{entries.length}</span>
      </div>
      <div className="pipeline-col-body">
        {entries.length === 0 ? (
          <p className="pipeline-col-empty">No candidates</p>
        ) : (
          entries.map(entry => (
            <PipelineCandidate key={entry.id} entry={entry} />
          ))
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────

export default function RoleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { recruiter } = useRecruiter()

  const [role, setRole] = useState(null)
  const [pipeline, setPipeline] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id || !recruiter?.id) return

    async function fetchRole() {
      const [roleRes, pipelineRes] = await Promise.all([
        supabase
          .from('roles')
          .select('id, title, status, comp_min, comp_max, comp_type, process_steps, clients(name)')
          .eq('id', id)
          .eq('recruiter_id', recruiter.id)
          .single(),

        supabase
          .from('pipeline')
          .select('id, current_stage, fit_score, candidate_id, candidates(id, first_name, last_name, current_title)')
          .eq('role_id', id)
          .eq('status', 'active'),
      ])

      if (roleRes.error || !roleRes.data) {
        setNotFound(true)
      } else {
        setRole(roleRes.data)
        setPipeline(pipelineRes.data ?? [])
      }

      setLoading(false)
    }

    fetchRole()
  }, [id, recruiter?.id])

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

  const comp = formatComp(role.comp_min, role.comp_max, role.comp_type)
  const stages = role.process_steps ?? []

  // Group pipeline entries by stage
  const byStage = Object.fromEntries(stages.map(s => [s, []]))
  for (const entry of pipeline) {
    if (byStage[entry.current_stage] !== undefined) {
      byStage[entry.current_stage].push(entry)
    }
  }

  return (
    <AppLayout>

      {/* Role header */}
      <div className="role-detail-header">
        <div className="role-detail-header-left">
          <button className="btn-back" onClick={() => navigate('/roles')}>← Back</button>
          <div>
            <div className="role-detail-title-row">
              <h1 className="page-title">{role.title}</h1>
              <span className={`role-status-badge role-status-badge--${role.status}`}>
                {STATUS_LABELS[role.status] ?? role.status}
              </span>
            </div>
            <p className="page-subtitle">
              {role.clients?.name ?? '—'}
              {comp && <span className="role-detail-comp"> · {comp}</span>}
            </p>
          </div>
        </div>
        <Link to={`/roles/${id}/edit`} className="btn-ghost">
          Edit
        </Link>
      </div>

      {/* Pipeline board */}
      {stages.length === 0 ? (
        <p className="muted">No hiring stages defined for this role.</p>
      ) : (
        <div className="pipeline-board">
          {stages.map(stage => (
            <PipelineColumn
              key={stage}
              stage={stage}
              entries={byStage[stage] ?? []}
            />
          ))}
        </div>
      )}

    </AppLayout>
  )
}
