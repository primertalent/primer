import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useRecruiter } from '../hooks/useRecruiter'
import { supabase } from '../lib/supabase'
import WrenCommand from '../components/WrenCommand'

const STAGE_PROB = { interviewing: 0.25, offer: 0.75, placed: 1.00 }
const URGENCY_ORDER = { overdue: 0, today: 1, active: 2, stale: 3 }

function daysSince(isoString) {
  return Math.floor((Date.now() - new Date(isoString).getTime()) / 86400000)
}

function daysDiff(isoString) {
  return Math.floor((new Date(isoString).getTime() - Date.now()) / 86400000)
}

function fmtDollar(n) {
  if (!n) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)    return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n)}`
}

function urgencyOf(entry, today) {
  if (!entry.next_action_due_at) {
    return daysSince(entry.created_at) >= 7 ? 'stale' : 'active'
  }
  const diff = daysDiff(entry.next_action_due_at)
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  return 'active'
}

// ── Pipeline Value (Zone 1) ───────────────────────────────

function PipelineValue({ recruiter }) {
  const [data, setData]         = useState(null)
  const [movement, setMovement] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!recruiter?.id) return
    load()
  }, [recruiter?.id])

  async function load() {
    const [pipeRes, moveRes] = await Promise.allSettled([
      supabase
        .from('pipeline')
        .select('id, current_stage, expected_comp, roles(placement_fee_pct, placement_fee_flat)')
        .eq('recruiter_id', recruiter.id)
        .eq('status', 'active')
        .in('current_stage', ['interviewing', 'offer', 'placed']),

      supabase
        .from('pipeline_stage_history')
        .select('id, to_stage, created_at, candidates(first_name, last_name)')
        .eq('recruiter_id', recruiter.id)
        .in('to_stage', ['interviewing', 'offer', 'placed'])
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    const entries = pipeRes.status === 'fulfilled' ? (pipeRes.value.data ?? []) : []

    let totalFull = 0
    let totalWeighted = 0

    for (const entry of entries) {
      const role = entry.roles
      let fee = 0
      if (role?.placement_fee_flat) {
        fee = role.placement_fee_flat
      } else if (entry.expected_comp && role?.placement_fee_pct) {
        fee = entry.expected_comp * role.placement_fee_pct
      }
      const prob = STAGE_PROB[entry.current_stage] ?? 0
      totalFull     += fee
      totalWeighted += fee * prob
    }

    setData({ total: totalFull, weighted: totalWeighted, count: entries.length })
    setMovement(moveRes.status === 'fulfilled' ? (moveRes.value.data ?? []) : [])
    setLoading(false)
  }

  return (
    <section className="pv-section">
      <div className="pv-header">
        <span className="pv-eyebrow">Pipeline Value</span>
        <Link to="/roles" className="pv-link">Deals →</Link>
      </div>

      {loading ? (
        <div className="pv-skeleton">
          <div className="skeleton skeleton-line" style={{ width: '40%', height: 36 }} />
          <div className="skeleton skeleton-line skeleton-line--sm" style={{ width: '28%' }} />
        </div>
      ) : (
        <>
          <div className="pv-numbers">
            <div className="pv-primary">
              <span className="pv-big">{fmtDollar(data?.total)}</span>
              <span className="pv-label">full value</span>
            </div>
            <div className="pv-divider" />
            <div className="pv-secondary">
              <span className="pv-weighted">{fmtDollar(data?.weighted)}</span>
              <span className="pv-label">probability-weighted</span>
            </div>
          </div>

          {data?.count === 0 && (
            <p className="pv-empty">No deals in interview, offer, or placed stages yet.</p>
          )}

          {movement.length > 0 && (
            <div className="pv-movement">
              {movement.map(m => (
                <span key={m.id} className="pv-move-item">
                  {m.candidates?.first_name} → {m.to_stage}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

// ── The Desk (Zone 2) ─────────────────────────────────────

function DeskRow({ entry, today }) {
  const urgency   = urgencyOf(entry, today)
  const candidate = entry.candidates
  const name      = `${candidate?.first_name ?? ''} ${candidate?.last_name ?? ''}`.trim()

  let riskText = null
  if (urgency === 'overdue') {
    const n = Math.abs(daysDiff(entry.next_action_due_at))
    riskText = `${n}d overdue`
  } else if (urgency === 'today') {
    riskText = 'due today'
  } else if (urgency === 'stale') {
    riskText = `${daysSince(entry.created_at)}d no action`
  }

  return (
    <Link to={`/network/${candidate?.id}`} className={`desk-row desk-row--${urgency}`}>
      <div className="desk-row-main">
        <span className="desk-name">{name}</span>
        <span className="desk-role">{entry.roles?.title ?? '—'}</span>
      </div>
      <div className="desk-row-meta">
        <span className="desk-stage">{entry.current_stage}</span>
        {riskText && <span className={`risk-pill risk-pill--${urgency}`}>{riskText}</span>}
      </div>
    </Link>
  )
}

function TheDesk({ recruiter }) {
  const [entries, setEntries] = useState(null)
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (!recruiter?.id) return
    load()
  }, [recruiter?.id])

  async function load() {
    const { data, error } = await supabase
      .from('pipeline')
      .select('id, current_stage, next_action_due_at, created_at, candidates(id, first_name, last_name), roles(id, title)')
      .eq('recruiter_id', recruiter.id)
      .eq('status', 'active')
      .neq('current_stage', 'placed')

    if (error || !data) { setLoading(false); return }

    const sorted = [...data].sort((a, b) => {
      const ua = URGENCY_ORDER[urgencyOf(a, today)] ?? 99
      const ub = URGENCY_ORDER[urgencyOf(b, today)] ?? 99
      if (ua !== ub) return ua - ub
      if (a.next_action_due_at && b.next_action_due_at)
        return new Date(a.next_action_due_at) - new Date(b.next_action_due_at)
      if (a.next_action_due_at) return -1
      if (b.next_action_due_at) return 1
      return 0
    })

    setEntries(sorted)
    setLoading(false)
  }

  const overdue  = (entries ?? []).filter(e => urgencyOf(e, today) === 'overdue')
  const dueToday = (entries ?? []).filter(e => urgencyOf(e, today) === 'today')
  const rest     = (entries ?? []).filter(e => !['overdue', 'today'].includes(urgencyOf(e, today)))

  return (
    <section className="desk-section">
      <div className="desk-header">
        <span className="desk-eyebrow">The Desk</span>
        <Link to="/network/new" className="desk-link">+ Add candidate</Link>
      </div>

      {loading ? (
        <div className="desk-skeleton">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton skeleton-line" style={{ height: 48, marginBottom: 6 }} />
          ))}
        </div>
      ) : !entries?.length ? (
        <p className="desk-empty">
          No active pipeline.{' '}
          <Link to="/roles/new">Add a role →</Link>
        </p>
      ) : (
        <div className="desk-list">
          {overdue.length > 0 && (
            <>
              <div className="desk-divider desk-divider--overdue">Overdue · {overdue.length}</div>
              {overdue.map(e => <DeskRow key={e.id} entry={e} today={today} />)}
            </>
          )}
          {dueToday.length > 0 && (
            <>
              <div className="desk-divider desk-divider--today">Due Today · {dueToday.length}</div>
              {dueToday.map(e => <DeskRow key={e.id} entry={e} today={today} />)}
            </>
          )}
          {rest.length > 0 && (
            <>
              {(overdue.length > 0 || dueToday.length > 0) && (
                <div className="desk-divider">Active · {rest.length}</div>
              )}
              {rest.map(e => <DeskRow key={e.id} entry={e} today={today} />)}
            </>
          )}
        </div>
      )}
    </section>
  )
}

// ── Dashboard ─────────────────────────────────────────────

export default function Dashboard() {
  const { recruiter } = useRecruiter()

  return (
    <AppLayout>
      {/* Zone 3 — WrenCommand */}
      <WrenCommand />

      {/* Zone 1 — Pipeline Value */}
      {recruiter && <PipelineValue recruiter={recruiter} />}

      {/* Zone 2 — The Desk */}
      {recruiter && <TheDesk recruiter={recruiter} />}
    </AppLayout>
  )
}
