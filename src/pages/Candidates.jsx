import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useRecruiter } from '../hooks/useRecruiter'
import { supabase } from '../lib/supabase'
import { highestUrgencyClass } from '../lib/urgency'

// ── Constants ─────────────────────────────────────────

const SOURCE_LABELS = {
  sourced:   'Sourced',
  inbound:   'Inbound',
  referral:  'Referral',
  job_board: 'Job Board',
  other:     'Other',
}

// ── Helpers ───────────────────────────────────────────

function highestFit(pipeline) {
  return (pipeline ?? []).reduce((max, p) => {
    if (p.fit_score != null && p.fit_score > max) return p.fit_score
    return max
  }, -1)
}

function activePipelineCount(pipeline) {
  return (pipeline ?? []).filter(p => p.status === 'active').length
}

function formatLastTouch(iso) {
  if (!iso) return null
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

// ── Sub-components ────────────────────────────────────

function FitBadge({ score }) {
  if (score < 0) return <span className="fit-badge fit-badge--none">—</span>
  const tenth = score / 10
  const display = Number.isInteger(tenth) ? tenth : tenth.toFixed(1)
  let variant = 'none'
  if (score >= 80) variant = 'green'
  else if (score >= 50) variant = 'amber'
  else variant = 'red'
  return (
    <span className={`fit-badge fit-badge--${variant}`}>
      {display}<span className="fit-badge-denom">/10</span>
    </span>
  )
}

function SkillTags({ skills }) {
  if (!skills?.length) return <span className="muted" style={{ fontSize: 12 }}>—</span>
  const visible = skills.slice(0, 3)
  const extra = skills.length - 3
  return (
    <div className="skill-tags-sm">
      {visible.map(s => <span key={s} className="skill-tag-sm">{s}</span>)}
      {extra > 0 && <span className="skill-tag-sm skill-tag-sm--more">+{extra}</span>}
    </div>
  )
}

function SortHeader({ label, col, sortCol, sortDir, onSort }) {
  const active = sortCol === col
  const indicator = active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''
  return (
    <th className={`candidates-th candidates-th--sortable${active ? ' candidates-th--active' : ''}`}>
      <button className="sort-btn" onClick={() => onSort(col)}>
        {label}{indicator}
      </button>
    </th>
  )
}

// ── Main page ─────────────────────────────────────────

export default function Candidates() {
  const { recruiter } = useRecruiter()
  const navigate = useNavigate()

  const [candidates, setCandidates] = useState([])
  const [lastTouchMap, setLastTouchMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  const [search, setSearch]           = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [skillFilter, setSkillFilter] = useState('')
  const [sortCol, setSortCol]         = useState('name')
  const [sortDir, setSortDir]         = useState('asc')

  useEffect(() => {
    if (!recruiter?.id) return

    async function fetchAll() {
      const [candidatesRes, interactionsRes] = await Promise.all([
        supabase
          .from('candidates')
          .select(`
            id, first_name, last_name, current_title, current_company,
            location, source, skills,
            pipeline ( id, status, fit_score, next_action_due_at )
          `)
          .eq('recruiter_id', recruiter.id)
          .order('created_at', { ascending: false }),

        supabase
          .from('interactions')
          .select('candidate_id, occurred_at')
          .eq('recruiter_id', recruiter.id)
          .order('occurred_at', { ascending: false }),
      ])

      if (candidatesRes.error) setFetchError('Couldn\'t load candidates. Try refreshing.')
      else setCandidates(candidatesRes.data ?? [])

      // Build candidate_id → most recent interaction date map
      const map = {}
      for (const row of interactionsRes.data ?? []) {
        if (!map[row.candidate_id]) map[row.candidate_id] = row.occurred_at
      }
      setLastTouchMap(map)
      setLoading(false)
    }

    fetchAll()
  }, [recruiter?.id])

  // Unique skills across all candidates for the filter dropdown
  const allSkills = useMemo(() => {
    const set = new Set()
    for (const c of candidates) {
      for (const s of c.skills ?? []) set.add(s)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [candidates])

  function handleSort(col) {
    setSortCol(prev => {
      if (prev === col) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return col }
      setSortDir('asc')
      return col
    })
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = candidates.filter(c => {
      if (sourceFilter && c.source !== sourceFilter) return false
      if (skillFilter && !(c.skills ?? []).includes(skillFilter)) return false
      if (!q) return true
      const name = `${c.first_name} ${c.last_name}`.toLowerCase()
      const title = (c.current_title ?? '').toLowerCase()
      const company = (c.current_company ?? '').toLowerCase()
      return name.includes(q) || title.includes(q) || company.includes(q)
    })

    list = [...list].sort((a, b) => {
      let cmp = 0
      if (sortCol === 'name') {
        cmp = `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
      } else if (sortCol === 'fit') {
        cmp = highestFit(b.pipeline) - highestFit(a.pipeline)
      } else if (sortCol === 'lastTouch') {
        const aD = lastTouchMap[a.id] ? new Date(lastTouchMap[a.id]).getTime() : 0
        const bD = lastTouchMap[b.id] ? new Date(lastTouchMap[b.id]).getTime() : 0
        cmp = bD - aD
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return list
  }, [candidates, search, sourceFilter, skillFilter, sortCol, sortDir, lastTouchMap])

  return (
    <AppLayout>
      <div className="roles-header">
        <div>
          <h1 className="brief-headline">Candidates</h1>
          <p className="brief-date">
            {loading
              ? 'Loading…'
              : `${filtered.length} of ${candidates.length} ${candidates.length === 1 ? 'candidate' : 'candidates'}`}
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
          <select
            className="field-input candidates-source-filter"
            value={skillFilter}
            onChange={e => setSkillFilter(e.target.value)}
          >
            <option value="">All skills</option>
            {allSkills.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : fetchError ? (
        <div className="page-error">
          <p className="page-error-title">Something went wrong</p>
          <p className="page-error-body">{fetchError}</p>
        </div>
      ) : candidates.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">No candidates yet.</p>
          <p className="empty-state-body">Drop a resume in the command bar or add one manually to get started.</p>
          <button className="btn-primary" onClick={() => navigate('/candidates/new')}>
            Add a candidate
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">No candidates match your filters.</p>
          <p className="empty-state-body" style={{ marginBottom: 0 }}>
            <button
              className="btn-ghost btn-sm"
              onClick={() => { setSearch(''); setSourceFilter(''); setSkillFilter('') }}
              style={{ marginTop: 12 }}
            >
              Clear filters
            </button>
          </p>
        </div>
      ) : (
        <div className="candidates-table-wrap">
          <table className="candidates-table">
            <thead>
              <tr>
                <SortHeader label="Name" col="name" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <th className="candidates-th">Title / Company</th>
                <th className="candidates-th">Location</th>
                <th className="candidates-th">Source</th>
                <th className="candidates-th">Skills</th>
                <SortHeader label="Fit" col="fit" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <th className="candidates-th">Roles</th>
                <SortHeader label="Last Touch" col="lastTouch" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const fit = highestFit(c.pipeline)
                const active = activePipelineCount(c.pipeline)
                const lastTouch = lastTouchMap[c.id] ?? null
                return (
                  <tr key={c.id} className="candidates-tr">
                    <td className="candidates-td candidates-td--name">
                      <Link to={`/candidates/${c.id}`} className="candidate-table-name">
                        {c.first_name} {c.last_name}
                      </Link>
                    </td>
                    <td className="candidates-td">
                      {(c.current_title || c.current_company) ? (
                        <span className="candidate-table-role">
                          {[c.current_title, c.current_company].filter(Boolean).join(' · ')}
                        </span>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td className="candidates-td">
                      <span className="candidate-table-location">{c.location || '—'}</span>
                    </td>
                    <td className="candidates-td">
                      {c.source ? (
                        <span className={`source-badge source-badge--${c.source}`}>
                          {SOURCE_LABELS[c.source] ?? c.source}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="candidates-td">
                      <SkillTags skills={c.skills} />
                    </td>
                    <td className="candidates-td">
                      <FitBadge score={fit} />
                    </td>
                    <td className="candidates-td">
                      {active > 0 ? (
                        <span className="candidate-table-roles">
                          {(() => { const uc = highestUrgencyClass(c.pipeline); return uc ? <span className={`urgency-dot ${uc}`} /> : null })()}
                          {active} {active === 1 ? 'role' : 'roles'}
                        </span>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td className="candidates-td">
                      <span className="candidate-table-touch">
                        {formatLastTouch(lastTouch) ?? <span className="muted">—</span>}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  )
}
