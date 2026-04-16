import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useRecruiter } from '../hooks/useRecruiter'
import { supabase } from '../lib/supabase'
import WrenCommand from '../components/WrenCommand'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function getFormattedDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function daysSince(isoString) {
  return Math.floor((Date.now() - new Date(isoString).getTime()) / 86400000)
}

// ── Activity Digest ───────────────────────────────────────

function ActivityDigest({ recruiter }) {
  const [digest, setDigest] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!recruiter?.id) return
    load()
  }, [recruiter?.id])

  async function load() {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [candidatesRes, stagesRes, screenersRes, interactionsRes] = await Promise.allSettled([
      supabase
        .from('candidates')
        .select('*', { count: 'exact', head: true })
        .eq('recruiter_id', recruiter.id)
        .gte('created_at', yesterday),

      supabase
        .from('pipeline_stage_history')
        .select('*', { count: 'exact', head: true })
        .eq('recruiter_id', recruiter.id)
        .gte('created_at', yesterday),

      supabase
        .from('screener_results')
        .select('*', { count: 'exact', head: true })
        .eq('recruiter_id', recruiter.id)
        .gte('created_at', yesterday),

      supabase
        .from('interactions')
        .select('*', { count: 'exact', head: true })
        .eq('recruiter_id', recruiter.id)
        .gte('created_at', yesterday),
    ])

    setDigest({
      newCandidates: candidatesRes.status === 'fulfilled' ? (candidatesRes.value.count ?? 0) : 0,
      stageAdvances: stagesRes.status     === 'fulfilled' ? (stagesRes.value.count     ?? 0) : 0,
      screenersRun:  screenersRes.status  === 'fulfilled' ? (screenersRes.value.count  ?? 0) : 0,
      interactions:  interactionsRes.status === 'fulfilled' ? (interactionsRes.value.count ?? 0) : 0,
    })
    setLoading(false)
  }

  const lines = []
  if (digest) {
    if (digest.newCandidates > 0) lines.push(`${digest.newCandidates} new candidate${digest.newCandidates !== 1 ? 's' : ''} added`)
    if (digest.stageAdvances > 0) lines.push(`${digest.stageAdvances} pipeline advance${digest.stageAdvances !== 1 ? 's' : ''}`)
    if (digest.screenersRun  > 0) lines.push(`${digest.screenersRun} screener${digest.screenersRun !== 1 ? 's' : ''} run`)
    if (digest.interactions  > 0) lines.push(`${digest.interactions} interaction${digest.interactions !== 1 ? 's' : ''} logged`)
  }

  return (
    <section className="digest-card">
      <p className="digest-eyebrow">Since yesterday</p>
      {loading ? (
        <div className="digest-loading"><div className="spinner spinner--sm" /></div>
      ) : lines.length === 0 ? (
        <p className="digest-empty">No activity since yesterday.</p>
      ) : (
        <ul className="digest-list">
          {lines.map((line, i) => <li key={i} className="digest-item">{line}</li>)}
        </ul>
      )}
    </section>
  )
}

// ── Needs Attention ───────────────────────────────────────

const ATTENTION_ICONS = {
  overdue:     '⚠️',
  today:       '⏰',
  unscreened:  '🟡',
  unscheduled: '💤',
  queue:       '📋',
}

function AttentionCard({ variant, insight, name, role, href, actionLabel }) {
  return (
    <div className={`attention-card attention-card--${variant}`}>
      <div className="attention-card-body">
        <span className="attention-card-icon">{ATTENTION_ICONS[variant]}</span>
        <div className="attention-card-content">
          <p className="attention-insight">{insight}</p>
          {(name || role) && (
            <p className="attention-who">{[name, role].filter(Boolean).join(' · ')}</p>
          )}
        </div>
      </div>
      <Link to={href} className="attention-action">{actionLabel}</Link>
    </div>
  )
}

function NeedsAttention({ recruiter }) {
  const [items, setItems]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!recruiter?.id) return
    load()
  }, [recruiter?.id])

  async function load() {
    setLoading(true)
    const today     = new Date().toISOString().slice(0, 10)
    const staleDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [overdueRes, dueTodayRes, queueRes, unscheduledRes, unscreenedRes] = await Promise.allSettled([
      supabase
        .from('pipeline')
        .select('id, current_stage, next_action_due_at, candidates(id, first_name, last_name), roles(title)')
        .eq('recruiter_id', recruiter.id)
        .eq('status', 'active')
        .lt('next_action_due_at', today)
        .not('next_action_due_at', 'is', null)
        .order('next_action_due_at', { ascending: true })
        .limit(8),

      supabase
        .from('pipeline')
        .select('id, current_stage, next_action_due_at, candidates(id, first_name, last_name), roles(title)')
        .eq('recruiter_id', recruiter.id)
        .eq('status', 'active')
        .gte('next_action_due_at', today)
        .lte('next_action_due_at', today + 'T23:59:59')
        .limit(8),

      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('recruiter_id', recruiter.id)
        .eq('status', 'drafted'),

      supabase
        .from('pipeline')
        .select('id, current_stage, created_at, candidates(id, first_name, last_name), roles(title)')
        .eq('recruiter_id', recruiter.id)
        .eq('status', 'active')
        .is('next_action_due_at', null)
        .lt('created_at', staleDate)
        .order('created_at', { ascending: true })
        .limit(5),

      supabase
        .from('pipeline')
        .select('id, current_stage, candidates(id, first_name, last_name), roles(title)')
        .eq('recruiter_id', recruiter.id)
        .eq('status', 'active')
        .is('fit_score', null)
        .neq('current_stage', 'placed')
        .limit(5),
    ])

    setItems({
      overdue:      overdueRes.status      === 'fulfilled' ? (overdueRes.value.data      ?? []) : [],
      dueToday:     dueTodayRes.status     === 'fulfilled' ? (dueTodayRes.value.data     ?? []) : [],
      draftedCount: queueRes.status        === 'fulfilled' ? (queueRes.value.count       ?? 0)  : 0,
      unscheduled:  unscheduledRes.status  === 'fulfilled' ? (unscheduledRes.value.data  ?? []) : [],
      unscreened:   unscreenedRes.status   === 'fulfilled' ? (unscreenedRes.value.data   ?? []) : [],
    })
    setLoading(false)
  }

  const overdueCount = items?.overdue.length ?? 0

  // Deduplicate: unscreened rows that already appear in overdue/dueToday/unscheduled
  const seenIds = new Set([
    ...(items?.overdue.map(p => p.candidates.id) ?? []),
    ...(items?.dueToday.map(p => p.candidates.id) ?? []),
    ...(items?.unscheduled.map(p => p.candidates.id) ?? []),
  ])
  const uniqueUnscreened = (items?.unscreened ?? []).filter(p => !seenIds.has(p.candidates.id))

  const isEmpty = !loading && items &&
    items.overdue.length === 0 &&
    items.dueToday.length === 0 &&
    items.draftedCount === 0 &&
    uniqueUnscreened.length === 0 &&
    items.unscheduled.length === 0

  return (
    <section className="today-actions-card">
      <div className="today-actions-header">
        <p className="today-actions-eyebrow">Needs Attention</p>
        {overdueCount > 0 && (
          <span className="today-badge-overdue">{overdueCount} overdue</span>
        )}
      </div>

      {loading ? (
        <div className="today-actions-loading">
          <div className="spinner spinner--sm" />
        </div>
      ) : isEmpty ? (
        <p className="today-actions-empty">
          Pipeline clear. Nothing urgent right now.{' '}
          <Link to="/candidates" style={{ color: 'inherit', textDecorationColor: 'var(--color-border)' }}>
            Review candidates →
          </Link>
        </p>
      ) : (
        <div className="today-actions-list">
          {items.overdue.map(p => {
            const n = daysSince(p.next_action_due_at)
            return (
              <AttentionCard
                key={p.id}
                variant="overdue"
                insight={`Action overdue ${n} day${n !== 1 ? 's' : ''}`}
                name={`${p.candidates.first_name} ${p.candidates.last_name}`}
                role={p.roles?.title}
                href={`/candidates/${p.candidates.id}`}
                actionLabel="View"
              />
            )
          })}
          {items.dueToday.map(p => (
            <AttentionCard
              key={p.id}
              variant="today"
              insight="Follow up due today"
              name={`${p.candidates.first_name} ${p.candidates.last_name}`}
              role={p.roles?.title}
              href={`/candidates/${p.candidates.id}`}
              actionLabel="View"
            />
          ))}
          {items.draftedCount > 0 && (
            <AttentionCard
              variant="queue"
              insight={`${items.draftedCount} submission ${items.draftedCount !== 1 ? 'drafts' : 'draft'} ready to review`}
              href="/queue"
              actionLabel="Review"
            />
          )}
          {uniqueUnscreened.map(p => (
            <AttentionCard
              key={p.id + '-unscreened'}
              variant="unscreened"
              insight="No fit score yet"
              name={`${p.candidates.first_name} ${p.candidates.last_name}`}
              role={p.roles?.title}
              href={`/candidates/${p.candidates.id}`}
              actionLabel="View"
            />
          ))}
          {items.unscheduled.map(p => {
            const n = daysSince(p.created_at)
            return (
              <AttentionCard
                key={p.id}
                variant="unscheduled"
                insight={`${n} day${n !== 1 ? 's' : ''} in pipeline, no action set`}
                name={`${p.candidates.first_name} ${p.candidates.last_name}`}
                role={p.roles?.title}
                href={`/candidates/${p.candidates.id}`}
                actionLabel="View"
              />
            )
          })}
        </div>
      )}
    </section>
  )
}

// ── Today's Pipeline ──────────────────────────────────────

function TodayPipeline({ recruiter }) {
  const [roles, setRoles]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!recruiter?.id) return
    load()
  }, [recruiter?.id])

  async function load() {
    const { data, error } = await supabase
      .from('pipeline')
      .select('role_id, current_stage, roles(id, title, clients(name))')
      .eq('recruiter_id', recruiter.id)
      .eq('status', 'active')
      .neq('current_stage', 'placed')

    if (error || !data) { setLoading(false); return }

    const roleMap = {}
    for (const entry of data) {
      const rid = entry.role_id
      if (!roleMap[rid]) {
        roleMap[rid] = {
          id:     rid,
          title:  entry.roles?.title ?? 'Unknown role',
          client: entry.roles?.clients?.name ?? null,
          stages: {},
          count:  0,
        }
      }
      const stage = entry.current_stage ?? 'unknown'
      roleMap[rid].stages[stage] = (roleMap[rid].stages[stage] ?? 0) + 1
      roleMap[rid].count++
    }

    setRoles(Object.values(roleMap).sort((a, b) => b.count - a.count))
    setLoading(false)
  }

  return (
    <section className="today-pipeline-card">
      <p className="today-pipeline-eyebrow">Active Roles</p>
      {loading ? (
        <div className="today-pipeline-loading"><div className="spinner spinner--sm" /></div>
      ) : !roles?.length ? (
        <p className="today-pipeline-empty">
          No active pipeline.{' '}
          <Link to="/roles/new" style={{ color: 'inherit', textDecorationColor: 'var(--color-border)' }}>
            Add a role →
          </Link>
        </p>
      ) : (
        <div className="today-pipeline-list">
          {roles.map(role => (
            <Link key={role.id} to={`/roles/${role.id}`} className="today-pipeline-row">
              <div className="today-pipeline-left">
                <span className="today-pipeline-title">{role.title}</span>
                {role.client && <span className="today-pipeline-client">{role.client}</span>}
              </div>
              <div className="today-pipeline-right">
                <span className="today-pipeline-count">{role.count} active</span>
                <span className="today-pipeline-stages">
                  {Object.entries(role.stages)
                    .map(([stage, count]) => `${count} ${stage}`)
                    .join(', ')}
                </span>
              </div>
              <span className="today-action-arrow">View →</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

// ── Dashboard ─────────────────────────────────────────────

export default function Dashboard() {
  const { recruiter, loading: recruiterLoading } = useRecruiter()

  const firstName = recruiter?.full_name?.split(' ')[0] ?? ''

  return (
    <AppLayout>
      <section className="brief-greeting">
        <h1 className="brief-headline">
          {getGreeting()}{!recruiterLoading && firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="brief-date">{getFormattedDate()}</p>
      </section>

      {recruiter && <ActivityDigest recruiter={recruiter} />}
      {recruiter && <NeedsAttention recruiter={recruiter} />}
      {recruiter && <TodayPipeline recruiter={recruiter} />}

      <WrenCommand />
    </AppLayout>
  )
}
