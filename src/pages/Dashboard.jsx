import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useRecruiter } from '../hooks/useRecruiter'
import { useStats } from '../hooks/useStats'
import { supabase } from '../lib/supabase'
import { generateText } from '../lib/ai'
import { buildDailyBriefMessages } from '../lib/prompts/dailyBrief'
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

function todayDateString() {
  return new Date().toISOString().slice(0, 10)
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

export default function Dashboard() {
  const { recruiter, loading: recruiterLoading } = useRecruiter()
  const { stats, loading: statsLoading } = useStats(recruiter?.id)

  const [briefText, setBriefText]       = useState(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [briefError, setBriefError]     = useState(null)

  const firstName = recruiter?.full_name?.split(' ')[0] ?? ''

  useEffect(() => {
    if (!recruiter?.id || statsLoading) return
    generateBrief()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recruiter?.id, statsLoading])

  async function generateBrief() {
    if (briefLoading) return
    setBriefLoading(true)
    setBriefError(null)

    try {
      const today = todayDateString()

      // Check for a cached brief from today
      const { data: cached } = await supabase
        .from('daily_briefs')
        .select('content')
        .eq('recruiter_id', recruiter.id)
        .eq('brief_date', today)
        .maybeSingle()

      if (cached?.content) {
        setBriefText(cached.content)
        setBriefLoading(false)
        return
      }

      // Fetch pipeline context
      const now = new Date().toISOString()
      const [overdueRes, dueTodayRes, pipelineRes] = await Promise.allSettled([
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
          .from('pipeline')
          .select('id', { count: 'exact', head: true })
          .eq('recruiter_id', recruiter.id)
          .eq('status', 'active'),
      ])

      const overdue   = overdueRes.status === 'fulfilled'   ? (overdueRes.value.data   ?? []) : []
      const dueToday  = dueTodayRes.status === 'fulfilled'  ? (dueTodayRes.value.data  ?? []) : []
      const pipeline  = pipelineRes.status === 'fulfilled'  ? [] : [] // just need the count from stats

      const messages = buildDailyBriefMessages({
        overdue,
        dueToday,
        pipeline,
        stats: stats ?? { activeRoles: 0, candidatesInPipeline: 0, messagesToReview: 0 },
      })

      const text = await generateText({ messages, maxTokens: 256 })
      setBriefText(text.trim())

      // Save to daily_briefs (fail silently if table schema differs)
      supabase
        .from('daily_briefs')
        .upsert({ recruiter_id: recruiter.id, brief_date: today, content: text.trim() }, { onConflict: 'recruiter_id,brief_date' })
        .then(({ error }) => { if (error) console.warn('daily_briefs save failed:', error.message) })

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
            <p className="brief-card-eyebrow">Morning Brief</p>
            {briefText && !briefLoading && (
              <button
                className="btn-ghost btn-sm"
                onClick={generateBrief}
                disabled={briefLoading}
              >
                Refresh
              </button>
            )}
          </div>
          {briefLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <div className="spinner spinner--sm" />
              <span className="brief-card-body">Generating brief…</span>
            </div>
          ) : briefError ? (
            <p className="brief-card-body">
              Couldn't generate brief.{' '}
              <button
                onClick={generateBrief}
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
        <StatCard label="Active Roles" value={stats?.activeRoles} loading={statsLoading} to="/roles" />
        <StatCard label="Candidates in Pipeline" value={stats?.candidatesInPipeline} loading={statsLoading} to="/candidates" />
        <StatCard label="Messages to Review" value={stats?.messagesToReview} loading={statsLoading} to="/queue" />
      </section>

      <WrenCommand />

    </AppLayout>
  )
}
