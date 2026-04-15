import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useRecruiter } from '../hooks/useRecruiter'
import { useStats } from '../hooks/useStats'
import { supabase } from '../lib/supabase'
import { generateText } from '../lib/ai'
import { buildDailyBriefMessages } from '../lib/prompts/dailyBrief'
import WrenCommand from '../components/WrenCommand'

const BRIEF_TTL = 4 * 60 * 60 * 1000 // 4 hours

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

function todayDateString() {
  return new Date().toISOString().slice(0, 10)
}

function daysSince(isoString) {
  return Math.floor((Date.now() - new Date(isoString).getTime()) / 86400000)
}

function StatCard({ label, value, loading, to }) {
  const content = (
    <>
      <span className={`stat-value${loading ? ' stat-value--loading' : ''}`}>
        {loading ? '—' : value}
      </span>
      <span className="stat-label">{label}</span>
    </>
  )
  if (to) {
    return <Link to={to} className="stat-card stat-card--link">{content}</Link>
  }
  return <div className="stat-card">{content}</div>
}

// ── Today's Actions ───────────────────────────────────────

function ActionRow({ candidateId, name, stage, roleTitle, variant, label }) {
  return (
    <Link to={`/candidates/${candidateId}`} className={`today-action-row today-action-row--${variant}`}>
      <span className={`today-dot today-dot--${variant}`} />
      <span className="today-action-name">{name}</span>
      <span className="today-action-meta">{stage}{roleTitle ? ` · ${roleTitle}` : ''}</span>
      <span className="today-action-label">{label}</span>
      <span className="today-action-arrow">View →</span>
    </Link>
  )
}

function TodayActions({ recruiter }) {
  const [items, setItems]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!recruiter?.id) return
    load()
  }, [recruiter?.id])

  async function load() {
    setLoading(true)
    const today = todayDateString()
    const staleDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [overdueRes, dueTodayRes, queueRes, unscheduledRes] = await Promise.allSettled([
      supabase
        .from('pipeline')
        .select('id, current_stage, next_action, next_action_due_at, candidates(id, first_name, last_name), roles(title)')
        .eq('recruiter_id', recruiter.id)
        .eq('status', 'active')
        .lt('next_action_due_at', today)
        .not('next_action_due_at', 'is', null)
        .order('next_action_due_at', { ascending: true })
        .limit(8),

      supabase
        .from('pipeline')
        .select('id, current_stage, next_action, next_action_due_at, candidates(id, first_name, last_name), roles(title)')
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
    ])

    setItems({
      overdue:      overdueRes.status      === 'fulfilled' ? (overdueRes.value.data      ?? []) : [],
      dueToday:     dueTodayRes.status     === 'fulfilled' ? (dueTodayRes.value.data     ?? []) : [],
      draftedCount: queueRes.status        === 'fulfilled' ? (queueRes.value.count       ?? 0)  : 0,
      unscheduled:  unscheduledRes.status  === 'fulfilled' ? (unscheduledRes.value.data  ?? []) : [],
    })
    setLoading(false)
  }

  const isEmpty = !loading && items &&
    items.overdue.length === 0 &&
    items.dueToday.length === 0 &&
    items.draftedCount === 0 &&
    items.unscheduled.length === 0

  const overdueCount = items?.overdue.length ?? 0

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
          {items.overdue.map(p => (
            <ActionRow
              key={p.id}
              candidateId={p.candidates.id}
              name={`${p.candidates.first_name} ${p.candidates.last_name}`}
              stage={p.current_stage}
              roleTitle={p.roles?.title}
              variant="overdue"
              label={`${daysSince(p.next_action_due_at)}d overdue`}
            />
          ))}
          {items.dueToday.map(p => (
            <ActionRow
              key={p.id}
              candidateId={p.candidates.id}
              name={`${p.candidates.first_name} ${p.candidates.last_name}`}
              stage={p.current_stage}
              roleTitle={p.roles?.title}
              variant="today"
              label="due today"
            />
          ))}
          {items.draftedCount > 0 && (
            <Link to="/queue" className="today-action-row today-action-row--queue">
              <span className="today-dot today-dot--queue" />
              <span className="today-action-name">
                {items.draftedCount} submission {items.draftedCount !== 1 ? 'drafts' : 'draft'} waiting for approval
              </span>
              <span className="today-action-meta" />
              <span className="today-action-label">queue</span>
              <span className="today-action-arrow">Review →</span>
            </Link>
          )}
          {items.unscheduled.map(p => (
            <ActionRow
              key={p.id}
              candidateId={p.candidates.id}
              name={`${p.candidates.first_name} ${p.candidates.last_name}`}
              stage={p.current_stage}
              roleTitle={p.roles?.title}
              variant="unscheduled"
              label={`${daysSince(p.created_at)}d, no action set`}
            />
          ))}
        </div>
      )}
    </section>
  )
}

// ── Dashboard ─────────────────────────────────────────────

export default function Dashboard() {
  const { recruiter, loading: recruiterLoading } = useRecruiter()
  const { stats, loading: statsLoading } = useStats(recruiter?.id)

  const [briefText, setBriefText]       = useState(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [briefError, setBriefError]     = useState(null)

  const firstName = recruiter?.full_name?.split(' ')[0] ?? ''

  useEffect(() => {
    if (!recruiter?.id || statsLoading) return
    generateBrief(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recruiter?.id, statsLoading])

  async function generateBrief(force = false) {
    if (briefLoading) return
    setBriefLoading(true)
    setBriefError(null)

    const cacheKey = `wren_briefing_${recruiter.id}`

    // Check localStorage cache (4h TTL) unless force-refreshing
    if (!force) {
      try {
        const raw = localStorage.getItem(cacheKey)
        if (raw) {
          const { text, ts, v } = JSON.parse(raw)
          if (v === 2 && Date.now() - ts < BRIEF_TTL) {
            setBriefText(text)
            setBriefLoading(false)
            return
          }
        }
      } catch {}
    }

    try {
      const today = todayDateString()

      const [overdueRes, dueTodayRes, queueRes] = await Promise.allSettled([
        supabase
          .from('pipeline')
          .select('current_stage, next_action, next_action_due_at, candidates(first_name, last_name), roles(title)')
          .eq('recruiter_id', recruiter.id)
          .eq('status', 'active')
          .lt('next_action_due_at', today)
          .not('next_action_due_at', 'is', null),

        supabase
          .from('pipeline')
          .select('current_stage, next_action, next_action_due_at, candidates(first_name, last_name), roles(title)')
          .eq('recruiter_id', recruiter.id)
          .eq('status', 'active')
          .gte('next_action_due_at', today)
          .lte('next_action_due_at', today + 'T23:59:59'),

        supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('recruiter_id', recruiter.id)
          .eq('status', 'drafted'),
      ])

      const overdue      = overdueRes.status  === 'fulfilled' ? (overdueRes.value.data   ?? []) : []
      const dueToday     = dueTodayRes.status === 'fulfilled' ? (dueTodayRes.value.data  ?? []) : []
      const draftedCount = queueRes.status    === 'fulfilled' ? (queueRes.value.count    ?? 0)  : 0

      const messages = buildDailyBriefMessages({
        overdue,
        dueToday,
        draftedCount,
        stats: stats ?? { activeRoles: 0, candidatesInPipeline: 0 },
      })

      const text = await generateText({ messages, maxTokens: 128 })
      const trimmed = text.trim()
      setBriefText(trimmed)

      try {
        localStorage.setItem(cacheKey, JSON.stringify({ text: trimmed, ts: Date.now(), v: 2 }))
      } catch {}

    } catch (err) {
      console.error('Brief generation failed:', err)
      setBriefError(true)
    } finally {
      setBriefLoading(false)
    }
  }

  return (
    <AppLayout>
      <section className="brief-greeting">
        <h1 className="brief-headline">
          {getGreeting()}{!recruiterLoading && firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="brief-date">{getFormattedDate()}</p>
      </section>

      <section className="brief-card">
        <div className="brief-card-inner">
          <div className="brief-card-header">
            <p className="brief-card-eyebrow">Wren</p>
            {briefText && !briefLoading && (
              <button
                className="btn-ghost btn-sm"
                onClick={() => generateBrief(true)}
                disabled={briefLoading}
              >
                Refresh
              </button>
            )}
          </div>
          {briefLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <div className="spinner spinner--sm" />
              <span className="brief-card-body">Checking your pipeline…</span>
            </div>
          ) : briefError ? (
            <p className="brief-card-body">
              Couldn't generate a briefing.{' '}
              <button
                onClick={() => generateBrief(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3, fontSize: 'inherit', fontFamily: 'inherit', padding: 0 }}
              >
                Try again
              </button>
            </p>
          ) : briefText ? (
            <p className="brief-card-body">{briefText}</p>
          ) : (
            <p className="brief-card-body">
              Nothing to report yet.{' '}
              <Link to="/roles/new" style={{ color: 'inherit', textDecorationColor: 'var(--color-border)' }}>
                Add a role
              </Link>
              {' '}or{' '}
              <Link to="/candidates/new" style={{ color: 'inherit', textDecorationColor: 'var(--color-border)' }}>
                add a candidate
              </Link>
              {' '}to get started.
            </p>
          )}
        </div>
      </section>

      <section className="stats-row">
        <StatCard label="Active Roles"            value={stats?.activeRoles}           loading={statsLoading} to="/roles" />
        <StatCard label="Candidates in Pipeline"  value={stats?.candidatesInPipeline}  loading={statsLoading} to="/candidates" />
        <StatCard label="Messages to Review"      value={stats?.messagesToReview}      loading={statsLoading} to="/queue" />
      </section>

      {recruiter && <TodayActions recruiter={recruiter} />}

      <WrenCommand />
    </AppLayout>
  )
}
