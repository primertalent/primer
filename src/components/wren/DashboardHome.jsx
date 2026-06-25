import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { STAGES, STAGE_LABELS, ACTIVE_STAGES } from '../../lib/stages'

// Stage -> chip class. Ladder colors live in index.css. Stages are taxonomic
// (signal tokens, chip bg + hair border, meaning in the foreground) with one
// exception: offer is itself a PUSH verdict, so it earns --win. No amber/red on
// good-news stages.
const STAGE_CLASS = {
  submitted:    'stage-chip--submitted',
  first_round:  'stage-chip--first',
  middle_round: 'stage-chip--middle',
  final_round:  'stage-chip--final',
  offer:        'stage-chip--offer',
}

// Furthest-along first uses canonical stage order (submitted=0 .. offer=4).
function stageRank(key) {
  return STAGES.indexOf(key)
}

function StageChip({ stage }) {
  return (
    <span className={`stage-chip ${STAGE_CLASS[stage] || ''}`}>
      {STAGE_LABELS[stage] || stage}
    </span>
  )
}

// Read-only desk-state glance. Renders into the canvas above the persistent Wren
// shell; the composer below is the action surface. No edit controls (anti-CRM).
// Refreshes on every entry (remounts when the view switches to Desk).
export default function DashboardHome({ recruiter }) {
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)
  const [rows, setRows]       = useState([])   // candidates in process
  const [roles, setRoles]     = useState([])   // open roles + derived counts

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!recruiter?.id) return
      setLoading(true)
      setError(false)
      try {
        // Query A: active pipeline rows. Mirrors toolListPipeline's default filter
        // (api/wren.js) — active stages only, placed/lost excluded. RLS scopes to
        // the recruiter; the explicit eq matches loadTickerData's precedent.
        const { data: pipes, error: pErr } = await supabase
          .from('pipelines')
          .select('id, candidate_id, current_stage, updated_at, candidates(first_name, last_name), roles(id, title, clients(name))')
          .eq('recruiter_id', recruiter.id)
          .eq('status', 'active')
          .in('current_stage', [...ACTIVE_STAGES])
          .order('updated_at', { ascending: false })
          .limit(200)
        if (pErr) throw pErr

        // Query B: days_in_stage from open stage-history rows (exited_at IS NULL),
        // same source as the ticker and toolListPipeline. Fallback to updated_at
        // with an approx flag when no open row exists.
        const ids = (pipes || []).map(p => p.id)
        const enteredMap = {}
        if (ids.length) {
          const { data: hist } = await supabase
            .from('pipeline_stage_history')
            .select('pipeline_id, entered_at')
            .in('pipeline_id', ids)
            .is('exited_at', null)
            .order('entered_at', { ascending: false })
          for (const h of (hist || [])) {
            if (!enteredMap[h.pipeline_id]) enteredMap[h.pipeline_id] = h.entered_at
          }
        }

        // Query C: open roles, including ones with nobody in process (a 0-in-process
        // open role is real desk state). Counts are derived from Query A below.
        const { data: openRoles, error: rErr } = await supabase
          .from('roles')
          .select('id, title, clients(name)')
          .eq('recruiter_id', recruiter.id)
          .eq('status', 'open')
        if (rErr) throw rErr

        if (cancelled) return

        const now = Date.now()
        const candidates = (pipes || []).map(p => {
          const entered = enteredMap[p.id]
          const refTime = new Date(entered || p.updated_at).getTime()
          return {
            id:            p.id,
            candidate_id:  p.candidate_id,
            name:          [p.candidates?.first_name, p.candidates?.last_name].filter(Boolean).join(' ') || 'Unknown',
            stage:         p.current_stage,
            role_id:       p.roles?.id ?? null,
            role_title:    p.roles?.title ?? null,
            client_name:   p.roles?.clients?.name ?? null,
            days_in_stage: Math.max(0, Math.floor((now - refTime) / 86400000)),
            approx:        !entered,
          }
        })
        // Furthest-along first, then longest in stage — mirrors toolListPipeline.
        candidates.sort((a, b) =>
          (stageRank(b.stage) - stageRank(a.stage)) || (b.days_in_stage - a.days_in_stage)
        )

        // Per-role count + stage spread, derived from the in-process rows (free —
        // same data, no extra query).
        const byRole = new Map()
        for (const c of candidates) {
          if (!c.role_id) continue
          if (!byRole.has(c.role_id)) byRole.set(c.role_id, { count: 0, spread: {} })
          const agg = byRole.get(c.role_id)
          agg.count++
          agg.spread[c.stage] = (agg.spread[c.stage] || 0) + 1
        }
        const roleCards = (openRoles || []).map(r => {
          const agg = byRole.get(r.id) || { count: 0, spread: {} }
          return {
            id:          r.id,
            title:       r.title || 'Untitled role',
            client_name: r.clients?.name ?? null,
            count:       agg.count,
            spread:      agg.spread,
          }
        })
        // Most-active first; empty open roles sink, alpha within ties.
        roleCards.sort((a, b) => (b.count - a.count) || a.title.localeCompare(b.title))

        setRows(candidates)
        setRoles(roleCards)
      } catch (e) {
        console.error('[dash]', e.message)
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [recruiter?.id])

  if (loading) {
    return (
      <div className="dash-home">
        <div className="dash-empty">Loading the desk.</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dash-home">
        <div className="dash-empty">Could not load the desk. Switch to Desk again to retry.</div>
      </div>
    )
  }

  return (
    <div className="dash-home">
      <section className="dash-section">
        <div className="dash-section__head">
          <h2 className="dash-section__title">Candidates in Process</h2>
          <span className="dash-section__count">{rows.length}</span>
        </div>
        {rows.length === 0 ? (
          <div className="dash-empty">Nobody in process. Add a candidate by telling Wren below.</div>
        ) : (
          <div className="dash-roster">
            <div className="dash-roster__head">
              <span>Candidate</span>
              <span>Stage</span>
              <span>Role</span>
              <span className="dash-roster__days">Days</span>
            </div>
            {rows.map(c => (
              <div key={c.id} className="dash-roster__row">
                <span className="dash-roster__name">{c.name}</span>
                <span className="dash-roster__stage"><StageChip stage={c.stage} /></span>
                <span className="dash-roster__role">
                  {c.role_title || 'Unknown role'}
                  {c.client_name && <span className="dash-roster__client"> · {c.client_name}</span>}
                </span>
                <span className="dash-roster__days" title={c.approx ? 'Approximate — no stage-history row' : undefined}>
                  {c.approx ? '~' : ''}{c.days_in_stage}d
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="dash-section">
        <div className="dash-section__head">
          <h2 className="dash-section__title">Active Roles</h2>
          <span className="dash-section__count">{roles.length}</span>
        </div>
        {roles.length === 0 ? (
          <div className="dash-empty">No open roles. Tell Wren about a role to start one.</div>
        ) : (
          <div className="dash-roles">
            {roles.map(r => (
              <div key={r.id} className="dash-role-card">
                <div className="dash-role-card__head">
                  <span className="dash-role-card__title">{r.title}</span>
                  {r.client_name && <span className="dash-role-card__client">{r.client_name}</span>}
                </div>
                <div className="dash-role-card__stat">
                  <span className="dash-role-card__count">{r.count}</span>
                  <span className="dash-role-card__count-label">in process</span>
                </div>
                {r.count > 0 ? (
                  <div className="dash-role-card__spread">
                    {STAGES.filter(s => r.spread[s]).map(s => (
                      <span key={s} className="dash-role-card__spread-item">
                        {r.spread[s]} {STAGE_LABELS[s]}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="dash-role-card__spread dash-role-card__spread--empty">Pipeline empty</div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
