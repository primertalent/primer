import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useRecruiter } from '../hooks/useRecruiter'
import { supabase } from '../lib/supabase'

const SOURCE_LABELS = {
  sourced:   'Sourced',
  inbound:   'Inbound',
  referral:  'Referral',
  job_board: 'Job Board',
  other:     'Other',
}

function CandidateRow({ candidate }) {
  const activePipeline = (candidate.pipeline ?? []).filter(p => p.status === 'active').length

  const highestFit = (candidate.pipeline ?? []).reduce((max, p) => {
    if (p.fit_score != null && p.fit_score > max) return p.fit_score
    return max
  }, -1)

  return (
    <Link to={`/candidates/${candidate.id}`} className="candidate-row">
      <div className="candidate-row-main">
        <span className="candidate-row-name">
          {candidate.first_name} {candidate.last_name}
        </span>
        {(candidate.current_title || candidate.current_company) && (
          <span className="candidate-row-role">
            {[candidate.current_title, candidate.current_company].filter(Boolean).join(' · ')}
          </span>
        )}
        {candidate.location && (
          <span className="candidate-row-location">{candidate.location}</span>
        )}
      </div>

      <div className="candidate-row-meta">
        {candidate.source && (
          <span className={`source-badge source-badge--${candidate.source}`}>
            {SOURCE_LABELS[candidate.source] ?? candidate.source}
          </span>
        )}
        {activePipeline > 0 && (
          <span className="candidate-pipeline-count">
            {activePipeline} {activePipeline === 1 ? 'role' : 'roles'}
          </span>
        )}
        {highestFit >= 0 && (
          <span className="candidate-fit-score">
            {Math.round(highestFit)}<span className="fit-denom">/100</span>
          </span>
        )}
      </div>
    </Link>
  )
}

export default function Candidates() {
  const { recruiter } = useRecruiter()
  const navigate = useNavigate()

  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')

  useEffect(() => {
    if (!recruiter?.id) return

    async function fetchCandidates() {
      const { data, error } = await supabase
        .from('candidates')
        .select(`
          id, first_name, last_name, current_title, current_company,
          location, source,
          pipeline ( id, status, fit_score )
        `)
        .eq('recruiter_id', recruiter.id)
        .order('created_at', { ascending: false })

      if (!error) setCandidates(data ?? [])
      setLoading(false)
    }

    fetchCandidates()
  }, [recruiter?.id])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return candidates.filter(c => {
      if (sourceFilter && c.source !== sourceFilter) return false
      if (!q) return true
      const name = `${c.first_name} ${c.last_name}`.toLowerCase()
      const title = (c.current_title ?? '').toLowerCase()
      const company = (c.current_company ?? '').toLowerCase()
      return name.includes(q) || title.includes(q) || company.includes(q)
    })
  }, [candidates, search, sourceFilter])

  return (
    <AppLayout>
      <div className="roles-header">
        <div>
          <h1 className="brief-headline">Candidates</h1>
          <p className="brief-date">
            {loading ? 'Loading…' : `${candidates.length} ${candidates.length === 1 ? 'candidate' : 'candidates'}`}
          </p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/candidates/new')}>
          New Candidate
        </button>
      </div>

      {!loading && candidates.length > 0 && (
        <div className="candidates-filters">
          <input
            type="search"
            className="candidates-search"
            placeholder="Search by name, title, or company…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="field-input candidates-source-filter"
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
          >
            <option value="">All sources</option>
            {Object.entries(SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : candidates.length === 0 ? (
        <div className="empty-state">
          <p className="muted" style={{ marginBottom: 16 }}>No candidates yet.</p>
          <button className="btn-primary" onClick={() => navigate('/candidates/new')}>
            Upload your first candidate
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p className="muted">No candidates match your filters.</p>
        </div>
      ) : (
        <div className="candidates-list">
          {filtered.map(c => (
            <CandidateRow key={c.id} candidate={c} />
          ))}
        </div>
      )}
    </AppLayout>
  )
}
