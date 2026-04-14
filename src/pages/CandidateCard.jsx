import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useRecruiter } from '../hooks/useRecruiter'
import AppLayout from '../components/AppLayout'
import { generateText } from '../lib/ai'
import { buildNextActionMessages } from '../lib/prompts/nextAction'
import { buildScreenerMessages } from '../lib/prompts/resumeScreener'
import { buildCareerTimelineMessages } from '../lib/prompts/careerTimeline'

// ── Helpers ───────────────────────────────────────────────

const SOURCE_LABELS = {
  sourced: 'Sourced',
  inbound: 'Inbound',
  referral: 'Referral',
  job_board: 'Job Board',
  other: 'Other',
}

const TYPE_LABELS = {
  email: 'Email',
  linkedin: 'LinkedIn',
  text: 'Text',
  call: 'Call',
  note: 'Note',
  meeting: 'Meeting',
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDateShort(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── Tenure helpers ────────────────────────────────────

const MONTH_NAMES = ['january','february','march','april','may','june','july','august','september','october','november','december']

function parseDate(str) {
  if (!str) return null
  const s = str.trim().toLowerCase()
  if (s === 'present' || s === 'current' || s === 'now') return new Date()
  // "Month Year" or "Year"
  const parts = s.split(/\s+/)
  if (parts.length === 1) {
    const yr = parseInt(parts[0])
    return isNaN(yr) ? null : new Date(yr, 0)
  }
  const monthIdx = MONTH_NAMES.indexOf(parts[0])
  const yr = parseInt(parts[1])
  if (monthIdx === -1 || isNaN(yr)) return null
  return new Date(yr, monthIdx)
}

function monthsBetween(start, end) {
  const s = parseDate(start)
  const e = parseDate(end)
  if (!s || !e) return null
  return Math.max(0, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()))
}

function formatTenure(months) {
  if (months === null) return '—'
  const yrs = Math.floor(months / 12)
  const mos = months % 12
  if (yrs === 0) return `${mos}mo`
  if (mos === 0) return `${yrs}yr`
  return `${yrs}yr ${mos}mo`
}

function computeTenureSummary(timeline) {
  if (!timeline?.length) return null
  const durations = timeline.map(e => monthsBetween(e.start, e.end)).filter(m => m !== null)
  if (!durations.length) return null
  const total = durations.reduce((s, m) => s + m, 0)
  const avg = Math.round(total / durations.length)
  const first = timeline[0]
  const isCurrentRole = first?.end?.toLowerCase().includes('present') || first?.end?.toLowerCase().includes('current') || first?.end?.toLowerCase().includes('now')
  const current = isCurrentRole ? monthsBetween(first.start, 'Present') : null
  return { total, avg, current }
}

// ── Signal badge config ───────────────────────────────

const SIGNAL_CONFIG = {
  'Promoted':        { color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' },
  'Long Tenure':     { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  'Fast Riser':      { color: '#6b21a8', bg: '#faf5ff', border: '#e9d5ff' },
  'AI Experience':   { color: '#0e7490', bg: '#ecfeff', border: '#a5f3fc' },
  "President's Club":{ color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
  'Quota Buster':    { color: '#166534', bg: '#dcfce7', border: '#86efac' },
}

// ── Sub-components ────────────────────────────────────────

function DetailRow({ label, value }) {
  if (!value) return null
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  )
}

function SkillTags({ skills }) {
  if (!skills?.length) return <span className="detail-value muted">None listed</span>
  return (
    <div className="skill-tags">
      {skills.map(skill => (
        <span key={skill} className="skill-tag">{skill}</span>
      ))}
    </div>
  )
}

function PipelineEntry({ entry }) {
  const roleName = entry.roles?.title ?? 'Unknown role'
  const clientName = entry.roles?.clients?.name ?? 'Unknown client'

  return (
    <div className="pipeline-entry">
      <div className="pipeline-role">
        <span className="pipeline-role-title">{roleName}</span>
        <span className="pipeline-client">{clientName}</span>
      </div>
      <div className="pipeline-meta">
        <span className="stage-badge">{entry.current_stage}</span>
        {entry.fit_score != null && (
          <span className="fit-score">{Math.round(entry.fit_score)}<span className="fit-denom">/100</span></span>
        )}
      </div>
      {entry.next_action && (
        <div className="pipeline-next-action">
          <span className="detail-label">Next action</span>
          <span className="detail-value">{entry.next_action}</span>
          {entry.next_action_due_at && (
            <span className="due-date">Due {formatDateShort(entry.next_action_due_at)}</span>
          )}
        </div>
      )}
    </div>
  )
}

function InteractionEntry({ interaction }) {
  return (
    <div className="interaction-entry">
      <div className="interaction-meta">
        <span className="interaction-type">{TYPE_LABELS[interaction.type] ?? interaction.type}</span>
        {interaction.direction && (
          <span className="interaction-direction">{interaction.direction}</span>
        )}
        <span className="interaction-date">{formatDate(interaction.occurred_at)}</span>
      </div>
      {interaction.subject && (
        <p className="interaction-subject">{interaction.subject}</p>
      )}
      {interaction.body && (
        <p className="interaction-body">{interaction.body}</p>
      )}
    </div>
  )
}

// ── Signal badges ─────────────────────────────────────

function SignalBadges({ signals }) {
  if (!signals?.length) return null
  return (
    <div className="signal-badges">
      {signals.map(sig => {
        const cfg = SIGNAL_CONFIG[sig]
        if (!cfg) return null
        return (
          <span
            key={sig}
            className="signal-badge"
            style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
          >
            {sig}
          </span>
        )
      })}
    </div>
  )
}

// ── Career timeline ───────────────────────────────────

function TenureSummary({ summary }) {
  if (!summary) return null
  return (
    <div className="tenure-summary">
      <div className="tenure-stat">
        <span className="tenure-value">{formatTenure(summary.total)}</span>
        <span className="tenure-label">Total Experience</span>
      </div>
      <div className="tenure-divider" />
      <div className="tenure-stat">
        <span className="tenure-value">{formatTenure(summary.avg)}</span>
        <span className="tenure-label">Avg Tenure</span>
      </div>
      {summary.current !== null && (
        <>
          <div className="tenure-divider" />
          <div className="tenure-stat">
            <span className="tenure-value">{formatTenure(summary.current)}</span>
            <span className="tenure-label">Current Role</span>
          </div>
        </>
      )}
    </div>
  )
}

function CareerEntry({ entry }) {
  const duration = monthsBetween(entry.start, entry.end)
  return (
    <div className="career-entry">
      <div className="career-entry-header">
        <div className="career-entry-identity">
          <span className="career-company">{entry.company}</span>
          <span className="career-title">{entry.title}</span>
        </div>
        <div className="career-entry-meta">
          {entry.start && (
            <span className="career-dates">
              {entry.start} – {entry.end ?? 'Present'}
            </span>
          )}
          {duration !== null && (
            <span className="career-duration">{formatTenure(duration)}</span>
          )}
        </div>
      </div>
      {entry.achievements?.length > 0 && (
        <ul className="career-achievements">
          {entry.achievements.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      )}
    </div>
  )
}

// ── Screener result ───────────────────────────────────────

const REC_STYLES = {
  advance: 'screener-rec--advance',
  hold:    'screener-rec--hold',
  pass:    'screener-rec--pass',
}

const SKILL_STYLES = {
  full:    'skill-status--full',
  partial: 'skill-status--partial',
  missing: 'skill-status--missing',
}

function ScreenerResult({ result }) {
  const recClass = REC_STYLES[result.recommendation] ?? ''
  const recLabel = result.recommendation
    ? result.recommendation.charAt(0).toUpperCase() + result.recommendation.slice(1)
    : '—'

  return (
    <div className="screener-result">
      <div className="screener-result-header">
        <div className="screener-score">
          <span className="screener-score-value">{result.match_score}</span>
          <span className="screener-score-denom">/10</span>
        </div>
        <span className={`screener-rec-badge ${recClass}`}>{recLabel}</span>
        {result.recommendation_reason && (
          <p className="screener-rec-reason">{result.recommendation_reason}</p>
        )}
      </div>

      {result.skills_match?.length > 0 && (
        <div className="screener-block">
          <p className="screener-block-label">Skills Match</p>
          <div className="screener-skills">
            {result.skills_match.map((s, i) => (
              <div key={i} className="screener-skill-row">
                <span className="screener-skill-name">{s.skill}</span>
                <span className={`screener-skill-status ${SKILL_STYLES[s.status] ?? ''}`}>
                  {s.status === 'full' ? 'Full' : s.status === 'partial' ? 'Partial' : 'Missing'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="screener-two-col">
        {result.top_strengths?.length > 0 && (
          <div className="screener-block">
            <p className="screener-block-label">Strengths</p>
            <ul className="screener-list screener-list--strengths">
              {result.top_strengths.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}
        {result.top_concerns?.length > 0 && (
          <div className="screener-block">
            <p className="screener-block-label">Concerns</p>
            <ul className="screener-list screener-list--concerns">
              {result.top_concerns.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}
      </div>

      {result.career_trajectory && (
        <div className="screener-block">
          <p className="screener-block-label">Career Trajectory</p>
          <p className="screener-block-body">{result.career_trajectory}</p>
        </div>
      )}

      {result.quantified_results && (
        <div className="screener-block">
          <p className="screener-block-label">Quantified Results</p>
          <p className="screener-block-body">{result.quantified_results}</p>
        </div>
      )}

      {result.red_flags?.length > 0 && (
        <div className="screener-block">
          <p className="screener-block-label">Red Flags</p>
          <ul className="screener-list screener-list--flags">
            {result.red_flags.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────

export default function CandidateCard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { recruiter } = useRecruiter()

  const [candidate, setCandidate] = useState(null)
  const [pipelines, setPipelines] = useState([])
  const [interactions, setInteractions] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [suggestion, setSuggestion] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState(null)

  // Add-to-role picker
  const [pickerOpen, setPickerOpen] = useState(false)
  const [openRoles, setOpenRoles] = useState(null)
  const [rolesLoading, setRolesLoading] = useState(false)
  const [addingRoleId, setAddingRoleId] = useState(null)
  const [addError, setAddError] = useState(null)

  // Resume screener
  const [screenerRoleId, setScreenerRoleId] = useState('')
  const [screening, setScreening] = useState(false)
  const [screenResult, setScreenResult] = useState(null)
  const [screenError, setScreenError] = useState(null)

  // Delete
  const [deleting, setDeleting] = useState(false)

  // Career timeline
  const [timeline, setTimeline] = useState(null)
  const [signals, setSignals] = useState(null)
  const [parsingCareer, setParsingCareer] = useState(false)
  const [careerError, setCareerError] = useState(null)

  useEffect(() => {
    if (!id || !recruiter?.id) return

    async function fetchAll() {
      // Log auth state and recruiter context for debugging
      const { data: { user: authUser } } = await supabase.auth.getUser()
      console.debug('[CandidateCard] auth user id:', authUser?.id)
      console.debug('[CandidateCard] recruiter row:', recruiter)
      console.debug('[CandidateCard] fetching candidate id:', id)

      const [candidateRes, pipelineRes, interactionRes, rolesRes] = await Promise.all([
        supabase
          .from('candidates')
          .select('*')
          .eq('id', id)
          .single(),

        supabase
          .from('pipeline')
          .select(`
            *,
            roles (
              title,
              clients ( name )
            )
          `)
          .eq('candidate_id', id),

        supabase
          .from('interactions')
          .select('*')
          .eq('candidate_id', id)
          .order('occurred_at', { ascending: true }),

        supabase
          .from('roles')
          .select('id, title, notes, process_steps, clients(name)')
          .eq('recruiter_id', recruiter.id)
          .eq('status', 'open')
          .order('created_at', { ascending: false }),
      ])

      console.debug('[CandidateCard] candidate result:', {
        data: candidateRes.data,
        error: candidateRes.error,
        // PGRST116 = no rows returned (RLS filtered it out or ID doesn't exist)
        errorCode: candidateRes.error?.code,
        errorMessage: candidateRes.error?.message,
      })
      console.debug('[CandidateCard] pipeline result:', {
        count: pipelineRes.data?.length,
        error: pipelineRes.error,
      })
      console.debug('[CandidateCard] interactions result:', {
        count: interactionRes.data?.length,
        error: interactionRes.error,
      })

      if (candidateRes.error || !candidateRes.data) {
        console.warn(
          '[CandidateCard] candidate not accessible — likely RLS mismatch.\n' +
          'Check that the candidate\'s recruiter_id in Supabase matches recruiter.id above.\n' +
          'Error code:', candidateRes.error?.code,
          '| Message:', candidateRes.error?.message
        )
        setNotFound(true)
      } else {
        const c = candidateRes.data
        setCandidate(c)
        setPipelines(pipelineRes.data ?? [])
        setInteractions(interactionRes.data ?? [])
        setOpenRoles(rolesRes.data ?? [])

        // Restore persisted career data if available
        if (c.career_timeline?.length > 0) {
          setTimeline(c.career_timeline)
          setSignals(c.career_signals ?? [])
        }
      }

      setLoading(false)
    }

    fetchAll()
  }, [id, recruiter])

  async function handleGenerateNextAction() {
    if (!candidate) return
    setSuggestion(null)
    setGenError(null)
    setGenerating(true)

    try {
      const messages = buildNextActionMessages(candidate, pipelines, interactions)
      const text = await generateText({ messages })
      setSuggestion(text || 'No suggestion returned.')
    } catch (err) {
      setGenError(err.message ?? 'Failed to generate suggestion.')
    } finally {
      setGenerating(false)
    }
  }

  function handleOpenPicker() {
    setAddError(null)
    setPickerOpen(prev => !prev)
  }

  async function handleScreen() {
    const role = openRoles?.find(r => r.id === screenerRoleId)
    if (!role || !candidate) return
    setScreenResult(null)
    setScreenError(null)
    setScreening(true)
    try {
      const messages = buildScreenerMessages(candidate, role)
      const raw = await generateText({ messages, maxTokens: 2048 })
      const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
      const result = JSON.parse(cleaned)
      setScreenResult(result)

      // Persist score to the matching pipeline entry
      const pipelineEntry = pipelines.find(p => p.role_id === screenerRoleId)
      if (pipelineEntry && result.match_score != null) {
        const fitScore = result.match_score * 10
        const rationale = result.recommendation_reason ?? null
        await supabase
          .from('pipeline')
          .update({ fit_score: fitScore, fit_score_rationale: rationale })
          .eq('id', pipelineEntry.id)
        // Update local state so Scores History reflects immediately
        setPipelines(prev => prev.map(p =>
          p.id === pipelineEntry.id
            ? { ...p, fit_score: fitScore, fit_score_rationale: rationale }
            : p
        ))
      }
    } catch (err) {
      setScreenError(err.message ?? 'Screening failed.')
    } finally {
      setScreening(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${candidate.first_name} ${candidate.last_name}? This cannot be undone.`)) return
    setDeleting(true)
    await supabase.from('candidates').delete().eq('id', id)
    navigate('/candidates')
  }

  async function handleParseCareer() {
    if (!candidate?.cv_text) return
    setTimeline(null)
    setSignals(null)
    setCareerError(null)
    setParsingCareer(true)
    try {
      const messages = buildCareerTimelineMessages(candidate.cv_text)
      const raw = await generateText({ messages, maxTokens: 2048 })
      const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
      const parsed = JSON.parse(cleaned)
      const tl = parsed.timeline ?? []
      const sg = parsed.signals ?? []
      setTimeline(tl)
      setSignals(sg)
      // Persist to DB
      const { error: saveErr } = await supabase
        .from('candidates')
        .update({ career_timeline: tl, career_signals: sg })
        .eq('id', id)
      if (saveErr) console.error('career save failed:', saveErr)
    } catch (err) {
      setCareerError(err.message ?? 'Failed to parse career history.')
    } finally {
      setParsingCareer(false)
    }
  }

  async function handleAddToRole(role) {
    if (addingRoleId) return
    setAddError(null)
    setAddingRoleId(role.id)

    const firstStage = role.process_steps?.[0] ?? 'Sourced'
    const { data: entry, error } = await supabase
      .from('pipeline')
      .insert({
        recruiter_id:  recruiter.id,
        candidate_id:  id,
        role_id:       role.id,
        current_stage: firstStage,
        status:        'active',
      })
      .select(`*, roles(title, clients(name))`)
      .single()

    if (error) {
      setAddError(error.message)
    } else {
      setPipelines(prev => [...prev, entry])
      setPickerOpen(false)
    }
    setAddingRoleId(null)
  }

  // ── Render states ────────────────────────────────────────

  if (loading) {
    return <AppLayout><p className="muted">Loading…</p></AppLayout>
  }

  if (notFound) {
    return (
      <AppLayout>
        <p className="muted">Candidate not found.</p>
        <button className="btn-ghost" style={{ marginTop: 16 }} onClick={() => navigate('/candidates')}>
          Go back
        </button>
      </AppLayout>
    )
  }

  const fullName = `${candidate.first_name} ${candidate.last_name}`

  return (
    <AppLayout>

        {/* Page header */}
        <div className="page-header">
          <div className="page-header-left">
            <button className="btn-back" onClick={() => navigate('/candidates')}>← Back</button>
            <div>
              <h1 className="page-title">{fullName}</h1>
              {candidate.current_title && candidate.current_company && (
                <p className="page-subtitle">{candidate.current_title} · {candidate.current_company}</p>
              )}
            </div>
          </div>
          <div className="page-header-actions">
            <Link className="btn-ghost" to={`/candidates/${id}/edit`}>Edit</Link>
            <button className="btn-ghost btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
            <button
              className="btn-primary"
              onClick={handleGenerateNextAction}
              disabled={generating}
            >
              {generating ? 'Generating…' : 'Generate Next Action'}
            </button>
          </div>
        </div>

        {/* Signal badges */}
        {signals?.length > 0 && <SignalBadges signals={signals} />}

        {/* AI suggestion */}
        {(suggestion || genError) && (
          <div className={`ai-card ${genError ? 'ai-card--error' : ''}`}>
            <p className="ai-card-eyebrow">
              {genError ? 'Error' : 'Suggested Next Action'}
            </p>
            <p className="ai-card-body">{genError || suggestion}</p>
          </div>
        )}

        {/* Two-column layout */}
        <div className="candidate-columns">

          {/* Left: Candidate details */}
          <section className="candidate-section">
            <h2 className="section-heading">Candidate Details</h2>
            <DetailRow label="Email" value={candidate.email} />
            <DetailRow label="Phone" value={candidate.phone} />
            <DetailRow
              label="LinkedIn"
              value={candidate.linkedin_url
                ? <a href={candidate.linkedin_url} target="_blank" rel="noreferrer">{candidate.linkedin_url}</a>
                : null}
            />
            <DetailRow label="Location" value={candidate.location} />
            <DetailRow label="Source" value={SOURCE_LABELS[candidate.source] ?? candidate.source} />
            <div className="detail-row">
              <span className="detail-label">Skills</span>
              <SkillTags skills={candidate.skills} />
            </div>
            {candidate.notes && (
              <div className="detail-row detail-row--block">
                <span className="detail-label">Notes</span>
                <p className="detail-notes">{candidate.notes}</p>
              </div>
            )}
          </section>

          {/* Right: Pipeline status */}
          <section className="candidate-section">
            <div className="section-heading-row">
              <h2 className="section-heading">Pipeline</h2>
              <button className="btn-ghost btn-sm" onClick={handleOpenPicker}>
                {pickerOpen ? 'Cancel' : '+ Add to Role'}
              </button>
            </div>

            {/* Role picker */}
            {pickerOpen && (
              <div className="role-picker">
                {rolesLoading ? (
                  <p className="muted" style={{ padding: '10px 0' }}>Loading roles…</p>
                ) : openRoles?.length === 0 ? (
                  <p className="muted" style={{ padding: '10px 0' }}>No open roles.</p>
                ) : (
                  <ul className="role-picker-list">
                    {openRoles.map(role => {
                      const alreadyAdded = pipelines.some(p => p.role_id === role.id)
                      const isAdding = addingRoleId === role.id
                      return (
                        <li key={role.id}>
                          <button
                            className={`role-picker-option${alreadyAdded ? ' role-picker-option--added' : ''}`}
                            onClick={() => !alreadyAdded && handleAddToRole(role)}
                            disabled={alreadyAdded || !!addingRoleId}
                          >
                            <span className="role-picker-title">{role.title}</span>
                            {role.clients?.name && (
                              <span className="role-picker-client">{role.clients.name}</span>
                            )}
                            {alreadyAdded && <span className="role-picker-check">✓</span>}
                            {isAdding && <span className="role-picker-check">…</span>}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
                {addError && <p className="error" style={{ marginTop: 8 }}>{addError}</p>}
              </div>
            )}

            {pipelines.length === 0 ? (
              <p className="muted">Not in any pipeline yet.</p>
            ) : (
              pipelines.map(entry => (
                <PipelineEntry key={entry.id} entry={entry} />
              ))
            )}
          </section>

        </div>

        {/* Resume Screener */}
        <section className="candidate-section screener-section" style={{ marginTop: 24 }}>
          <h2 className="section-heading">Resume Screener</h2>
          <div className="screener-controls">
            <select
              className="field-input screener-role-select"
              value={screenerRoleId}
              onChange={e => {
                setScreenerRoleId(e.target.value)
                setScreenResult(null)
                setScreenError(null)
              }}
              disabled={!openRoles}
            >
              <option value="">
                {openRoles === null ? 'Loading roles…' : 'Select a role to screen against…'}
              </option>
              {openRoles?.map(r => (
                <option key={r.id} value={r.id}>
                  {r.title}{r.clients?.name ? ` — ${r.clients.name}` : ''}
                </option>
              ))}
            </select>
            <button
              className="btn-primary"
              onClick={handleScreen}
              disabled={!screenerRoleId || screening}
            >
              {screening ? 'Screening…' : 'Screen Against Role'}
            </button>
          </div>

          {screenError && (
            <div className="ai-card ai-card--error" style={{ marginTop: 16 }}>
              <p className="ai-card-eyebrow">Error</p>
              <p className="ai-card-body">{screenError}</p>
            </div>
          )}

          {screenResult && <ScreenerResult result={screenResult} />}
        </section>

        {/* Career Timeline */}
        <section className="candidate-section" style={{ marginTop: 24 }}>
          <div className="section-heading-row">
            <h2 className="section-heading">Career Timeline</h2>
            {candidate.cv_text && !timeline && (
              <button
                className="btn-ghost btn-sm"
                onClick={handleParseCareer}
                disabled={parsingCareer}
              >
                {parsingCareer ? 'Parsing…' : 'Parse from CV'}
              </button>
            )}
          </div>
          {careerError && <p className="error" style={{ marginTop: 8 }}>{careerError}</p>}
          {!candidate.cv_text && <p className="muted">No CV text available. Upload a resume to enable career parsing.</p>}
          {timeline !== null && (
            <>
              {(() => {
                const summary = computeTenureSummary(timeline)
                return summary ? <TenureSummary summary={summary} /> : null
              })()}
              {timeline.length === 0
                ? <p className="muted">No career history could be extracted.</p>
                : timeline.map((entry, i) => <CareerEntry key={i} entry={entry} />)
              }
            </>
          )}
        </section>

        {/* Scores History */}
        {pipelines.some(p => p.fit_score != null) && (
          <section className="candidate-section" style={{ marginTop: 24 }}>
            <h2 className="section-heading">Scores History</h2>
            <div className="scores-history">
              {pipelines
                .filter(p => p.fit_score != null)
                .sort((a, b) => b.fit_score - a.fit_score)
                .map(p => {
                  const score = p.fit_score
                  const tenth = score / 10
                  const display = Number.isInteger(tenth) ? tenth : tenth.toFixed(1)
                  let variant = 'none'
                  if (score >= 80) variant = 'green'
                  else if (score >= 50) variant = 'amber'
                  else variant = 'red'
                  return (
                    <div key={p.id} className="scores-history-row">
                      <div className="scores-history-role">
                        <span className="scores-history-title">{p.roles?.title ?? 'Unknown role'}</span>
                        {p.roles?.clients?.name && (
                          <span className="scores-history-client">{p.roles.clients.name}</span>
                        )}
                      </div>
                      <div className="scores-history-right">
                        <span className={`fit-badge fit-badge--${variant}`}>
                          {display}<span className="fit-badge-denom">/10</span>
                        </span>
                        {p.fit_score_rationale && (
                          <p className="scores-history-rationale">{p.fit_score_rationale}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          </section>
        )}

        {/* Interaction history */}
        <section className="candidate-section" style={{ marginTop: 24 }}>
          <h2 className="section-heading">Interaction History</h2>
          {interactions.length === 0 ? (
            <p className="muted">No interactions recorded yet.</p>
          ) : (
            <div className="interaction-feed">
              {interactions.map(i => (
                <InteractionEntry key={i.id} interaction={i} />
              ))}
            </div>
          )}
        </section>

    </AppLayout>
  )
}
