import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useRecruiter } from '../hooks/useRecruiter'
import { supabase } from '../lib/supabase'
import { highestUrgencyClass } from '../lib/urgency'

// ── Constants ─────────────────────────────────────────

const SIGNAL_CONFIG = {
  'Promoted':          { color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' },
  'Long Tenure':       { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  'Fast Riser':        { color: '#6b21a8', bg: '#faf5ff', border: '#e9d5ff' },
  'AI Experience':     { color: '#0e7490', bg: '#ecfeff', border: '#a5f3fc' },
  "President's Club":  { color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
  'Quota Buster':      { color: '#166534', bg: '#dcfce7', border: '#86efac' },
}

const ALL_SIGNALS = Object.keys(SIGNAL_CONFIG)

const STAGE_OPTIONS = ['sourced', 'screening', 'shortlisted', 'interviewing', 'offer', 'placed']

// ── Helpers ───────────────────────────────────────────

function topEntry(pipeline) {
  const active = (pipeline ?? []).filter(p => p.status === 'active')
  if (!active.length) return null
  return active.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
}

function highestFit(pipeline) {
  return (pipeline ?? []).reduce((max, p) => {
    if (p.fit_score != null && p.fit_score > max) return p.fit_score
    return max
  }, -1)
}

function highestRecruiterScore(pipeline) {
  return (pipeline ?? []).reduce((max, p) => {
    if (p.recruiter_score != null && p.recruiter_score > max) return p.recruiter_score
    return max
  }, -1)
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
  if (score < 0) return <span className="muted">—</span>
  const tenth = score / 10
  const display = Number.isInteger(tenth) ? tenth : tenth.toFixed(1)
  let variant = 'red'
  if (score >= 80) variant = 'green'
  else if (score >= 50) variant = 'amber'
  return (
    <span className={`fit-badge fit-badge--${variant}`}>
      {display}<span className="fit-badge-denom">/10</span>
    </span>
  )
}

function RecruiterScoreBadge({ score }) {
  if (score < 0) return <span className="muted">—</span>
  let variant = 'red'
  if (score >= 8) variant = 'green'
  else if (score >= 5) variant = 'amber'
  return (
    <span className={`fit-badge fit-badge--${variant}`}>
      {score}<span className="fit-badge-denom">/10</span>
    </span>
  )
}

function SignalPips({ signals }) {
  const arr = signals ?? []
  if (!arr.length) return <span className="muted">—</span>
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {arr.slice(0, 3).map(s => {
        const cfg = SIGNAL_CONFIG[s]
        if (!cfg) return null
        return (
          <span
            key={s}
            className="signal-badge"
            title={s}
            style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}
          >
            {s}
          </span>
        )
      })}
      {arr.length > 3 && (
        <span className="signal-badge" style={{ background: 'var(--color-bg)', color: 'var(--color-muted)', borderColor: 'var(--color-border)' }}>
          +{arr.length - 3}
        </span>
      )}
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

  const [candidates, setCandidates]       = useState([])
  const [lastTouchMap, setLastTouchMap]   = useState({})
  const [loading, setLoading]             = useState(true)
  const [fetchError, setFetchError]       = useState(null)

  const [search, setSearch]               = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [stageFilter, setStageFilter]     = useState('')
  const [signalFilter, setSignalFilter]   = useState('')
  const [skillFilter, setSkillFilter]     = useState('')
  const [fitFilter, setFitFilter]         = useState('')
  const [recencyFilter, setRecencyFilter] = useState('')
  const [sortCol, setSortCol]             = useState('lastTouch')
  const [sortDir, setSortDir]             = useState('desc')

  useEffect(() => {
    if (!recruiter?.id) return

    async function fetchAll() {
      const [candidatesRes, interactionsRes] = await Promise.all([
        supabase
          .from('candidates')
          .select(`
            id, first_name, last_name, current_title, current_company,
            skills, career_signals,
            pipeline (
              id, status, current_stage, fit_score, recruiter_score,
              next_action_due_at, created_at,
              roles ( id, title )
            )
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

      const map = {}
      for (const row of interactionsRes.data ?? []) {
        if (!map[row.candidate_id]) map[row.candidate_id] = row.occurred_at
      }
      setLastTouchMap(map)
      setLoading(false)
    }

    fetchAll()
  }, [recruiter?.id])

  // Debounced DB search
  useEffect(() => {
    const q = search.trim()
    if (!q || !recruiter?.id) {
      setSearchResults(null)
      setSearchLoading(false)
      return
    }
    setSearchLoading(true)
    const timer = setTimeout(async () => {
      const terms = q.split(/\s+/).slice(0, 3)
      const orClause = terms
        .map(t => `first_name.ilike.%${t}%,last_name.ilike.%${t}%,current_title.ilike.%${t}%,current_company.ilike.%${t}%`)
        .join(',')
      const { data } = await supabase
        .from('candidates')
        .select(`
          id, first_name, last_name, current_title, current_company,
          skills, career_signals,
          pipeline (
            id, status, current_stage, fit_score, recruiter_score,
            next_action_due_at, created_at,
            roles ( id, title )
          )
        `)
        .eq('recruiter_id', recruiter.id)
        .or(orClause)
        .order('created_at', { ascending: false })
      setSearchResults(data ?? [])
      setSearchLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, recruiter?.id])

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
      setSortDir('desc')
      return col
    })
  }

  const filtered = useMemo(() => {
    const base = searchResults ?? candidates
    const cutoff = recencyFilter
      ? new Date(Date.now() - parseInt(recencyFilter, 10) * 86400000)
      : null

    let list = base.filter(c => {
      if (skillFilter && !(c.skills ?? []).includes(skillFilter)) return false
      if (signalFilter && !(c.career_signals ?? []).includes(signalFilter)) return false

      const top = topEntry(c.pipeline)
      if (stageFilter && top?.current_stage?.toLowerCase() !== stageFilter) return false

      if (fitFilter) {
        const fit = highestFit(c.pipeline)
        if (fitFilter === 'strong'     && fit < 80)                   return false
        if (fitFilter === 'solid'      && (fit < 50 || fit >= 80))    return false
        if (fitFilter === 'low'        && (fit < 0  || fit >= 50))    return false
        if (fitFilter === 'unscreened' && fit >= 0)                   return false
      }

      if (cutoff) {
        const lt = lastTouchMap[c.id]
        if (!lt || new Date(lt) < cutoff) return false
      }

      return true
    })

    list = [...list].sort((a, b) => {
      let cmp = 0
      if (sortCol === 'name') {
        cmp = `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
      } else if (sortCol === 'aiScore') {
        cmp = highestFit(b.pipeline) - highestFit(a.pipeline)
      } else if (sortCol === 'recruiterScore') {
        cmp = highestRecruiterScore(b.pipeline) - highestRecruiterScore(a.pipeline)
      } else if (sortCol === 'lastTouch') {
        const aD = lastTouchMap[a.id] ? new Date(lastTouchMap[a.id]).getTime() : 0
        const bD = lastTouchMap[b.id] ? new Date(lastTouchMap[b.id]).getTime() : 0
        cmp = bD - aD
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return list
  }, [candidates, searchResults, stageFilter, signalFilter, skillFilter, fitFilter, recencyFilter, sortCol, sortDir, lastTouchMap])

  const hasFilters = stageFilter || signalFilter || skillFilter || fitFilter || recencyFilter || search

  function clearFilters() {
    setSearch('')
    setStageFilter('')
    setSignalFilter('')
    setSkillFilter('')
    setFitFilter('')
    setRecencyFilter('')
  }

  return (
    <AppLayout>
      <div className="roles-header">
        <div>
          <h1 className="brief-headline">Your Network</h1>
          <p className="brief-date">
            {loading
              ? 'Loading…'
              : searchLoading
              ? 'Searching…'
              : searchResults !== null
              ? `${filtered.length} ${filtered.length === 1 ? 'result' : 'results'}`
              : `${filtered.length} of ${candidates.length} in network`}
          </p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/network/new')}>
          Add Candidate
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
            value={stageFilter}
            onChange={e => setStageFilter(e.target.value)}
          >
            <option value="">All stages</option>
            {STAGE_OPTIONS.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <select
            className="field-input candidates-source-filter"
            value={fitFilter}
            onChange={e => setFitFilter(e.target.value)}
          >
            <option value="">All fit scores</option>
            <option value="strong">Strong (8+)</option>
            <option value="solid">Solid (5–7)</option>
            <option value="low">Low (&lt;5)</option>
            <option value="unscreened">Unscreened</option>
          </select>
          <select
            className="field-input candidates-source-filter"
            value={signalFilter}
            onChange={e => setSignalFilter(e.target.value)}
          >
            <option value="">All signals</option>
            {ALL_SIGNALS.map(s => (
              <option key={s} value={s}>{s}</option>
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
          <select
            className="field-input candidates-source-filter"
            value={recencyFilter}
            onChange={e => setRecencyFilter(e.target.value)}
          >
            <option value="">Any time</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          {hasFilters && (
            <button className="btn-ghost btn-sm" onClick={clearFilters}>
              Clear
            </button>
          )}
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
          <button className="btn-primary" onClick={() => navigate('/network/new')}>
            Add a candidate
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">No candidates match your filters.</p>
          <button className="btn-ghost btn-sm" onClick={clearFilters} style={{ marginTop: 12 }}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="candidates-table-wrap">
          <table className="candidates-table">
            <thead>
              <tr>
                <SortHeader label="Name" col="name" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <th className="candidates-th">Last Role</th>
                <th className="candidates-th">Stage</th>
                <SortHeader label="Last Touch" col="lastTouch" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <th className="candidates-th">Signals</th>
                <SortHeader label="You" col="recruiterScore" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="AI" col="aiScore" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const top = topEntry(c.pipeline)
                const aiScore = highestFit(c.pipeline)
                const recScore = highestRecruiterScore(c.pipeline)
                const lastTouch = lastTouchMap[c.id] ?? null
                const urgency = highestUrgencyClass(c.pipeline)
                return (
                  <tr key={c.id} className="candidates-tr">
                    <td className="candidates-td candidates-td--name">
                      <Link to={`/candidates/${c.id}`} className="candidate-table-name">
                        {urgency && <span className={`urgency-dot ${urgency}`} />}
                        {c.first_name} {c.last_name}
                      </Link>
                      {(c.current_title || c.current_company) && (
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                          {[c.current_title, c.current_company].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </td>
                    <td className="candidates-td">
                      {top?.roles?.title
                        ? <span className="candidate-table-role">{top.roles.title}</span>
                        : <span className="muted">—</span>}
                    </td>
                    <td className="candidates-td">
                      {top?.current_stage
                        ? <span className="stage-badge">{top.current_stage}</span>
                        : <span className="muted">—</span>}
                    </td>
                    <td className="candidates-td">
                      <span className="candidate-table-touch">
                        {formatLastTouch(lastTouch) ?? <span className="muted">—</span>}
                      </span>
                    </td>
                    <td className="candidates-td">
                      <SignalPips signals={c.career_signals} />
                    </td>
                    <td className="candidates-td">
                      <RecruiterScoreBadge score={recScore} />
                    </td>
                    <td className="candidates-td">
                      <FitBadge score={aiScore} />
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
