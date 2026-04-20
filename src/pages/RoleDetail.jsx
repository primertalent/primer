import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useRecruiter } from '../hooks/useRecruiter'
import { supabase } from '../lib/supabase'
import { generateText } from '../lib/ai'
import { buildSubmissionMessages } from '../lib/prompts/submissionDraft'
import { buildInterviewQuestionMessages } from '../lib/prompts/interviewQuestionGenerator'
import { buildBooleanSearchMessages } from '../lib/prompts/booleanSearchBuilder'
import { urgencyClass } from '../lib/urgency'

// ── Helpers ───────────────────────────────────────────────

const STATUS_LABELS = {
  open:      'Open',
  on_hold:   'On Hold',
  filled:    'Filled',
  cancelled: 'Cancelled',
}

const COMP_TYPE_SUFFIXES = {
  salary:             '/yr',
  hourly:             '/hr',
  contract:           '/yr',
  equity_plus_salary: '/yr + equity',
}

function formatDateShort(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatComp(min, max, type) {
  if (!min && !max) return null
  const fmt = n => `$${Number(n).toLocaleString()}`
  const range = (min && max)
    ? `${fmt(min)} – ${fmt(max)}`
    : min ? `${fmt(min)}+` : `Up to ${fmt(max)}`
  return `${range}${COMP_TYPE_SUFFIXES[type] ?? ''}`
}

function formatMoney(n) {
  if (n == null || n === 0) return null
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`
  return `$${Math.round(n).toLocaleString()}`
}

function formatFeeLabel(role) {
  if (role.placement_fee_flat) {
    const k = Math.round(role.placement_fee_flat / 1000)
    return k > 0 ? `$${k}k flat` : `$${role.placement_fee_flat} flat`
  }
  if (role.placement_fee_pct) return `${Math.round(role.placement_fee_pct * 100)}% fee`
  return null
}

function daysOpenCount(createdAt) {
  if (!createdAt) return null
  return Math.floor((Date.now() - new Date(createdAt)) / (1000 * 60 * 60 * 24))
}

function calcPotentialValue(role) {
  const openings = role.openings ?? 1
  if (role.placement_fee_flat) return role.placement_fee_flat * openings
  if (!role.placement_fee_pct) return null
  const min = role.target_comp_min
  const max = role.target_comp_max
  if (min != null || max != null) {
    const mid = (min != null && max != null) ? (min + max) / 2 : (min ?? max)
    return mid * role.placement_fee_pct * openings
  }
  return null
}

function calcCurrentValue(pipeline, role) {
  if (!role.placement_fee_pct && !role.placement_fee_flat) return 0
  let total = 0
  for (const entry of pipeline) {
    if (!entry.expected_comp) continue
    const fee = role.placement_fee_flat
      ? role.placement_fee_flat
      : entry.expected_comp * (role.placement_fee_pct ?? 0)
    total += fee
  }
  return total
}

function computeHealthPills(role, pipeline, lastStageMoveDays, lastInteractionDays) {
  const pills = []
  if (!role.placement_fee_pct && !role.placement_fee_flat) {
    pills.push({ label: 'Fee not set', variant: 'amber' })
  }
  if (!role.agreement_id) {
    pills.push({ label: 'Agreement missing', variant: 'gray' })
  }
  if (pipeline.length > 0) {
    const hasInterview = pipeline.some(e => e.current_stage?.toLowerCase().includes('interview'))
    if (!hasInterview) pills.push({ label: 'No interviews', variant: 'amber' })
    const hasOverdue = pipeline.some(e =>
      e.next_action_due_at && new Date(e.next_action_due_at) < new Date()
    )
    if (hasOverdue) pills.push({ label: 'Overdue follow-up', variant: 'red' })
    if (lastStageMoveDays != null && lastStageMoveDays >= 7) {
      pills.push({ label: 'Stalled', variant: 'red' })
    }
  }
  if (lastInteractionDays != null && lastInteractionDays >= 7) {
    pills.push({ label: 'Cold client', variant: 'amber' })
  }
  return pills
}

// ── Role Status Bar ───────────────────────────────────────

function RoleStatusBar({ role, pipeline, onBack, healthPills, nextAction }) {
  const potential    = calcPotentialValue(role)
  const current      = calcCurrentValue(pipeline, role)
  const feeLabel     = formatFeeLabel(role)
  const days         = daysOpenCount(role.created_at)
  const openings     = role.openings ?? 1

  return (
    <div className="deal-status-bar">
      {/* Row 1: identity + deal value */}
      <div className="dsb-row dsb-row--main">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn-back" onClick={onBack} style={{ flexShrink: 0 }}>←</button>
          <div className="dsb-identity">
            <span className="dsb-name">{role.title}</span>
            <span className="dsb-subtitle">
              {role.clients?.name ?? '—'}
              {openings > 1 && <span> · {openings} openings</span>}
              {role.status !== 'open' && (
                <span className={`role-status-badge role-status-badge--${role.status}`} style={{ marginLeft: 6 }}>
                  {STATUS_LABELS[role.status] ?? role.status}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Deal value — the drool number */}
        <div className="rsb-value-block">
          {potential != null ? (
            <>
              <span className="rsb-potential">{formatMoney(potential)}</span>
              {current > 0 && (
                <span className="rsb-in-play">{formatMoney(current)} in play</span>
              )}
            </>
          ) : (
            <span className="rsb-no-value">
              {role.placement_fee_pct || role.placement_fee_flat
                ? 'Set target comp to calculate'
                : 'Set fee to calculate'}
            </span>
          )}
          {feeLabel && <span className="rsb-fee-label">{feeLabel}</span>}
        </div>
      </div>

      {/* Row 2: days open + health pills + next action */}
      <div className="dsb-row dsb-row--sub">
        {days != null && <span className="rsb-days-open">{days}d open</span>}
        {healthPills.length > 0 && (
          <div className="risk-pills">
            {healthPills.map(p => (
              <span key={p.label} className={`risk-pill risk-pill--${p.variant}`}>{p.label}</span>
            ))}
          </div>
        )}
        <div style={{ marginLeft: 'auto', minWidth: 0 }}>
          {nextAction ? (
            <span className="dsb-next-action">{nextAction}</span>
          ) : (
            <span className="dsb-next-action dsb-next-action--empty">No next action</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Zone C popover ────────────────────────────────────────

function RoleZoneCMenu({ role, onClose, onConfirmClose, onDelete }) {
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div className="zone-c-popover" ref={menuRef}>
      <button className="zone-c-item" onClick={() => { onConfirmClose(); onClose() }}>
        {role.status === 'filled' ? 'Reopen role' : 'Close role'}
      </button>
      <button className="zone-c-item zone-c-item--danger" onClick={() => { onDelete(); onClose() }}>
        Delete role
      </button>
    </div>
  )
}

// ── Network match stub ────────────────────────────────────

function NetworkMatchStub() {
  return (
    <section className="candidate-section" style={{ marginTop: 32 }}>
      <div className="section-heading-row">
        <h2 className="section-heading">Network Matches</h2>
      </div>
      <div className="zone-a-stub">
        <div>
          <span style={{ fontWeight: 600 }}>Coming next session —</span>
          {' '}Wren will surface candidates from your network that match this role based on skills, vertical, seniority, and last touch.
        </div>
      </div>
    </section>
  )
}

// ── Pipeline sub-components ───────────────────────────────

function fitScoreClass(score) {
  if (score == null) return ''
  if (score >= 70) return 'kcard-score--green'
  if (score >= 40) return 'kcard-score--amber'
  return 'kcard-score--red'
}

function PipelineCandidate({ entry, onAdvance, onGoBack, onDraftSubmission, onRemove, advancing }) {
  const uClass = urgencyClass(entry.next_action_due_at)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving]           = useState(false)
  const [removeError, setRemoveError]     = useState(null)

  async function handleConfirmRemove(e) {
    e.preventDefault()
    setRemoving(true)
    setRemoveError(null)
    const err = await onRemove(entry.id)
    if (err) {
      setRemoveError('Couldn\'t remove. Try again.')
      setRemoving(false)
      setConfirmRemove(false)
    }
  }

  const hasScores = entry.fit_score != null || entry.recruiter_score != null
  const signal    = entry.fit_score_rationale
    ? entry.fit_score_rationale.length > 72
      ? entry.fit_score_rationale.slice(0, 72) + '…'
      : entry.fit_score_rationale
    : null

  return (
    <div className="pipeline-candidate-card">
      <Link to={`/candidates/${entry.candidate_id}`} className="pipeline-candidate-info">
        <span className="pipeline-candidate-name">
          {entry.candidates.first_name} {entry.candidates.last_name}
        </span>
        {entry.candidates.current_title && (
          <span className="pipeline-candidate-title">{entry.candidates.current_title}</span>
        )}
        {hasScores && (
          <div className="kcard-scores">
            {entry.fit_score != null && (
              <span className={`kcard-score ${fitScoreClass(entry.fit_score)}`}>
                <span className="kcard-score-label">AI </span>{Math.round(entry.fit_score)}
              </span>
            )}
            {entry.fit_score != null && entry.recruiter_score != null && (
              <span className="kcard-score-divider">·</span>
            )}
            {entry.recruiter_score != null && (
              <span className="kcard-score kcard-score--recruiter">
                <span className="kcard-score-label">You </span>{entry.recruiter_score}
              </span>
            )}
          </div>
        )}
        {signal && <span className="kcard-signal">{signal}</span>}
        {entry.next_action && (
          <div className="kcard-next-action">
            <span className="kcard-next-action-text">{entry.next_action}</span>
          </div>
        )}
        {entry.next_action_due_at && (
          <span className="due-date">
            {uClass && <span className={`urgency-dot ${uClass}`} />}
            {formatDateShort(entry.next_action_due_at)}
          </span>
        )}
      </Link>
      <div className="pipeline-candidate-actions">
        <button
          className="btn-draft-submission"
          onClick={e => { e.preventDefault(); e.stopPropagation(); onDraftSubmission(entry) }}
          title="Draft submission"
        >✉</button>
        {onGoBack && (
          <button
            className="btn-go-back-stage"
            onClick={e => { e.preventDefault(); e.stopPropagation(); onGoBack(entry) }}
            title="Move back a stage"
            disabled={advancing}
          >{advancing ? '…' : '←'}</button>
        )}
        {onAdvance && (
          <button
            className="btn-advance-stage"
            onClick={e => { e.preventDefault(); e.stopPropagation(); onAdvance(entry) }}
            title="Advance to next stage"
            disabled={advancing}
          >{advancing ? '…' : '→'}</button>
        )}
        <button
          className="btn-kanban-remove"
          onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirmRemove(true) }}
          title="Remove from pipeline"
        >×</button>
      </div>
      {confirmRemove && (
        <div className="inline-confirm">
          <span>Remove?</span>
          <button className="btn-confirm-yes" onClick={handleConfirmRemove} disabled={removing}>
            {removing ? 'Removing…' : 'Yes'}
          </button>
          <button
            className="btn-confirm-cancel"
            onClick={e => { e.preventDefault(); setConfirmRemove(false) }}
          >
            Cancel
          </button>
        </div>
      )}
      {removeError && <p className="inline-error">{removeError}</p>}
    </div>
  )
}

function PipelineColumn({ stage, entries, stages, onAdvance, onGoBack, onDraftSubmission, onRemove, advancingId }) {
  const currentIndex = stages.indexOf(stage)
  const nextStage    = stages[currentIndex + 1] ?? null
  const prevStage    = stages[currentIndex - 1] ?? null
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
            <PipelineCandidate
              key={entry.id}
              entry={entry}
              onAdvance={nextStage ? onAdvance : null}
              onGoBack={prevStage ? onGoBack : null}
              onDraftSubmission={onDraftSubmission}
              onRemove={onRemove}
              advancing={advancingId === entry.id}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────

export default function RoleDetail() {
  const { id }        = useParams()
  const navigate      = useNavigate()
  const { recruiter } = useRecruiter()

  const [role, setRole]           = useState(null)
  const [pipeline, setPipeline]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [notFound, setNotFound]   = useState(false)
  const [fetchError, setFetchError] = useState(null)

  // Health signal state (secondary fetch)
  const [lastStageMoveDays, setLastStageMoveDays]         = useState(null)
  const [lastInteractionDays, setLastInteractionDays]     = useState(null)

  // Role actions
  const [confirmClose, setConfirmClose] = useState(false)
  const [closing, setClosing]           = useState(false)
  const [closeError, setCloseError]     = useState(null)
  const [deleting, setDeleting]         = useState(false)
  const [zoneCOpen, setZoneCOpen]       = useState(false)
  const [advancingId, setAdvancingId]   = useState(null)

  // Interview questions
  const [interviewQuestions, setInterviewQuestions]       = useState(null)
  const [interviewGenerating, setInterviewGenerating]     = useState(false)
  const [interviewError, setInterviewError]               = useState(null)
  const [interviewGuideSaving, setInterviewGuideSaving]   = useState(false)
  const [interviewGuideSaved, setInterviewGuideSaved]     = useState(false)
  const [clearInterviewConfirm, setClearInterviewConfirm] = useState(false)

  // Boolean search strings
  const [searchStrings, setSearchStrings]       = useState(null)
  const [searchGenerating, setSearchGenerating] = useState(false)
  const [searchError, setSearchError]           = useState(null)
  const [clearSearchConfirm, setClearSearchConfirm] = useState(false)

  // JD auto-format
  const jdAutoFormatFiredRef  = useRef(false)
  const [jdAutoFormatting, setJdAutoFormatting] = useState(false)
  const [formattedJd, setFormattedJd]           = useState(null)

  // Submission draft modal
  const [draftModal, setDraftModal] = useState({
    open: false, phase: 'pick', format: 'email',
    text: '', error: null, candidateName: '', candidateId: null, fitScore: null,
  })
  const [savingToQueue, setSavingToQueue] = useState(false)
  const [savedToQueue, setSavedToQueue]   = useState(false)
  const textareaRef = useRef(null)

  // ── Primary fetch ───────────────────────────────────────

  useEffect(() => {
    if (!id || !recruiter?.id) return

    async function fetchData() {
      const [roleRes, pipelineRes] = await Promise.all([
        supabase
          .from('roles')
          .select(`
            id, title, status, comp_min, comp_max, comp_type, comp_currency,
            process_steps, notes, formatted_jd, search_strings, interview_guide,
            placement_fee_pct, placement_fee_flat,
            target_comp_min, target_comp_max, openings,
            agreement_id, client_id, created_at,
            clients(name, id)
          `)
          .eq('id', id)
          .eq('recruiter_id', recruiter.id)
          .single(),

        supabase
          .from('pipeline')
          .select(`
            id, current_stage, fit_score, fit_score_rationale,
            next_action, next_action_due_at,
            candidate_id, recruiter_score, recruiter_note, expected_comp,
            candidates(id, first_name, last_name, current_title)
          `)
          .eq('role_id', id)
          .eq('status', 'active'),
      ])

      if (roleRes.error) {
        if (roleRes.error.code === 'PGRST116') setNotFound(true)
        else setFetchError(roleRes.error.message ?? 'Couldn\'t load this role.')
        setLoading(false)
        return
      }

      if (!roleRes.data) { setNotFound(true); setLoading(false); return }

      const pipeData = pipelineRes.data ?? []
      setRole(roleRes.data)
      setPipeline(pipeData)
      if (roleRes.data.search_strings)  setSearchStrings(roleRes.data.search_strings)
      if (roleRes.data.interview_guide) setInterviewQuestions(roleRes.data.interview_guide)
      if (roleRes.data.formatted_jd)    setFormattedJd(roleRes.data.formatted_jd)

      setLoading(false)

      // Non-blocking health signals
      fetchHealthSignals(pipeData)
    }

    fetchData()
  }, [id, recruiter?.id])

  async function fetchHealthSignals(pipeData) {
    const promises = [
      supabase
        .from('pipeline_stage_history')
        .select('created_at')
        .eq('role_id', id)
        .order('created_at', { ascending: false })
        .limit(1),
    ]

    const candidateIds = pipeData.map(e => e.candidate_id).filter(Boolean)
    if (candidateIds.length > 0) {
      promises.push(
        supabase
          .from('interactions')
          .select('occurred_at')
          .in('candidate_id', candidateIds)
          .order('occurred_at', { ascending: false })
          .limit(1)
      )
    }

    const [histRes, intRes] = await Promise.allSettled(promises)

    if (histRes.status === 'fulfilled' && histRes.value.data?.[0]) {
      const days = Math.floor((Date.now() - new Date(histRes.value.data[0].created_at)) / 86_400_000)
      setLastStageMoveDays(days)
    }
    if (intRes?.status === 'fulfilled' && intRes.value.data?.[0]) {
      const days = Math.floor((Date.now() - new Date(intRes.value.data[0].occurred_at)) / 86_400_000)
      setLastInteractionDays(days)
    }
  }

  // ── JD auto-format on load ──────────────────────────────

  useEffect(() => {
    if (!role?.notes || formattedJd || role?.formatted_jd || jdAutoFormatFiredRef.current) return
    jdAutoFormatFiredRef.current = true

    setJdAutoFormatting(true)
    generateText({
      system: 'You are a recruiting assistant. Clean up the job description text below. Remove HTML tags, excessive whitespace, broken line breaks, and formatting artifacts. Preserve all meaningful content: responsibilities, requirements, compensation, company info. Return plain text only. No markdown, no explanation.',
      messages: [{ role: 'user', content: role.notes }],
      maxTokens: 2048,
    })
      .then(formatted => {
        const trimmed = formatted.trim()
        setFormattedJd(trimmed)
        supabase.from('roles').update({ formatted_jd: trimmed }).eq('id', id)
          .then(({ error }) => { if (error) console.warn('formatted_jd save failed:', error.message) })
      })
      .catch(err => console.warn('JD auto-format failed silently:', err.message))
      .finally(() => setJdAutoFormatting(false))
  }, [role?.id])

  // ── Handlers ────────────────────────────────────────────

  async function handleCloseRole() {
    setClosing(true)
    setCloseError(null)
    const newStatus = role.status === 'filled' ? 'open' : 'filled'
    const { error } = await supabase.from('roles').update({ status: newStatus }).eq('id', id)
    if (error) {
      setCloseError('Couldn\'t update status. Try again.')
    } else {
      setRole(prev => ({ ...prev, status: newStatus }))
      setConfirmClose(false)
    }
    setClosing(false)
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${role.title}"? This cannot be undone.`)) return
    setDeleting(true)
    await supabase.from('roles').delete().eq('id', id)
    navigate('/roles')
  }

  async function handleBuildSearchStrings() {
    setSearchStrings(null)
    setSearchError(null)
    setSearchGenerating(true)
    try {
      const messages = buildBooleanSearchMessages(role)
      const raw      = await generateText({ messages, maxTokens: 1024 })
      const cleaned  = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
      const result   = JSON.parse(cleaned)
      setSearchStrings(result)
      supabase.from('roles').update({ search_strings: result }).eq('id', id)
        .then(({ error }) => { if (error) console.warn('search_strings save failed:', error.message) })
    } catch (err) {
      setSearchError(err.message ?? 'Failed to build search strings.')
    } finally {
      setSearchGenerating(false)
    }
  }

  async function handleGenerateInterviewQuestions() {
    setInterviewQuestions(null)
    setInterviewError(null)
    setInterviewGuideSaved(false)
    setInterviewGenerating(true)
    try {
      const messages = buildInterviewQuestionMessages(role, [])
      const raw      = await generateText({ messages, maxTokens: 2048 })
      const cleaned  = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
      setInterviewQuestions(JSON.parse(cleaned))
    } catch (err) {
      setInterviewError(err.message ?? 'Failed to generate questions.')
    } finally {
      setInterviewGenerating(false)
    }
  }

  async function handleSaveInterviewGuide() {
    if (!interviewQuestions) return
    setInterviewGuideSaving(true)
    setInterviewGuideSaved(false)
    const { error } = await supabase.from('roles').update({ interview_guide: interviewQuestions }).eq('id', id)
    if (error) console.warn('interview_guide save failed:', error.message)
    setInterviewGuideSaving(false)
    if (!error) setInterviewGuideSaved(true)
  }

  async function handleClearSearchStrings() {
    await supabase.from('roles').update({ search_strings: null }).eq('id', id)
    setSearchStrings(null)
    setClearSearchConfirm(false)
  }

  async function handleClearInterviewQuestions() {
    setInterviewQuestions(null)
    setInterviewGuideSaved(false)
    setClearInterviewConfirm(false)
    await supabase.from('roles').update({ interview_guide: null }).eq('id', id)
  }

  async function handleAdvanceStage(entry) {
    if (advancingId) return
    const currentIndex = stages.indexOf(entry.current_stage)
    const nextStage    = stages[currentIndex + 1]
    if (!nextStage) return
    setAdvancingId(entry.id)
    setPipeline(prev => prev.map(p => p.id === entry.id ? { ...p, current_stage: nextStage } : p))
    const { error } = await supabase.from('pipeline').update({ current_stage: nextStage }).eq('id', entry.id)
    if (error) {
      setPipeline(prev => prev.map(p => p.id === entry.id ? { ...p, current_stage: entry.current_stage } : p))
    }
    setAdvancingId(null)
  }

  async function handleGoBackStage(entry) {
    if (advancingId) return
    const currentIndex = stages.indexOf(entry.current_stage)
    const prevStage    = stages[currentIndex - 1]
    if (!prevStage) return
    setAdvancingId(entry.id)
    setPipeline(prev => prev.map(p => p.id === entry.id ? { ...p, current_stage: prevStage } : p))
    const { error } = await supabase.from('pipeline').update({ current_stage: prevStage }).eq('id', entry.id)
    if (error) {
      setPipeline(prev => prev.map(p => p.id === entry.id ? { ...p, current_stage: entry.current_stage } : p))
    }
    setAdvancingId(null)
  }

  async function handleRemoveFromPipeline(pipelineId) {
    const { error } = await supabase.from('pipeline').delete().eq('id', pipelineId)
    if (error) return error
    setPipeline(prev => prev.filter(p => p.id !== pipelineId))
    return null
  }

  function handleDraftSubmission(entry) {
    const candidateName = `${entry.candidates.first_name} ${entry.candidates.last_name}`
    setDraftModal({
      open: true, phase: 'pick', format: 'email', text: '', error: null,
      candidateName, candidateId: entry.candidate_id, fitScore: entry.fit_score,
    })
    setSavedToQueue(false)
  }

  async function handleGenerate() {
    const { candidateId, fitScore, format } = draftModal
    setDraftModal(prev => ({ ...prev, phase: 'generating', text: '', error: null }))
    setSavedToQueue(false)
    try {
      const { data: candidate, error: candidateErr } = await supabase
        .from('candidates').select('*').eq('id', candidateId).single()
      if (candidateErr || !candidate) throw new Error('Could not load candidate data.')
      const messages = buildSubmissionMessages(candidate, role, fitScore, format)
      const text     = await generateText({ messages, maxTokens: 1024 })
      setDraftModal(prev => ({ ...prev, phase: 'done', text }))
    } catch (err) {
      setDraftModal(prev => ({ ...prev, phase: 'error', error: err.message ?? 'Generation failed.' }))
    }
  }

  function closeDraftModal() {
    setDraftModal({
      open: false, phase: 'pick', format: 'email', text: '', error: null,
      candidateName: '', candidateId: null, fitScore: null,
    })
    setSavedToQueue(false)
  }

  async function handleSaveToQueue() {
    if (!draftModal.text || savingToQueue) return
    setSavingToQueue(true)
    const subject = `${draftModal.candidateName} — ${role.title}${role.clients?.name ? ` at ${role.clients.name}` : ''}`
    const { error } = await supabase.from('messages').insert({
      recruiter_id: recruiter.id,
      candidate_id: draftModal.candidateId,
      channel: 'email',
      subject,
      body: draftModal.text,
      status: 'drafted',
    })
    if (error) console.error('save to queue failed:', error)
    else setSavedToQueue(true)
    setSavingToQueue(false)
  }

  // ── Loading / error states ──────────────────────────────

  if (loading) {
    return <AppLayout><div className="loading-state"><div className="spinner" /></div></AppLayout>
  }

  if (fetchError) {
    return (
      <AppLayout>
        <div className="page-error">
          <p className="page-error-title">Couldn't load this role.</p>
          <p className="page-error-body">Check the browser console for details, then try refreshing.</p>
          <button className="btn-ghost" onClick={() => navigate('/roles')}>Back to Roles</button>
        </div>
      </AppLayout>
    )
  }

  if (notFound) {
    return (
      <AppLayout>
        <div className="page-error">
          <p className="page-error-title">Role not found.</p>
          <button className="btn-ghost" onClick={() => navigate('/roles')}>Back to Roles</button>
        </div>
      </AppLayout>
    )
  }

  // ── Derived state ───────────────────────────────────────

  const stages  = role.process_steps ?? []
  const byStage = Object.fromEntries(stages.map(s => [s, []]))
  for (const entry of pipeline) {
    if (byStage[entry.current_stage] !== undefined) byStage[entry.current_stage].push(entry)
  }

  const healthPills = computeHealthPills(role, pipeline, lastStageMoveDays, lastInteractionDays)

  // Most urgent next action across pipeline entries
  const sortedByDue = [...pipeline]
    .filter(e => e.next_action && e.next_action_due_at)
    .sort((a, b) => new Date(a.next_action_due_at) - new Date(b.next_action_due_at))
  const nextAction = sortedByDue[0]?.next_action
    ?? pipeline.find(e => e.next_action)?.next_action
    ?? null

  const jdToShow = formattedJd || role.formatted_jd || null
  const rawJd    = role.notes

  // ── Render ──────────────────────────────────────────────

  return (
    <AppLayout>

      {/* Sticky Role Status Bar */}
      <RoleStatusBar
        role={role}
        pipeline={pipeline}
        onBack={() => navigate('/roles')}
        healthPills={healthPills}
        nextAction={nextAction}
      />

      {/* Action zones */}
      <div style={{ marginTop: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>

          {/* Zone A — primary */}
          <div className="zone-a">
            <span className="zone-label">Work this role</span>
            <div className="zone-a-actions">
              <Link
                to={`/roles/${id}/edit`}
                className="zone-a-btn"
                style={{ textDecoration: 'none', display: 'inline-block' }}
              >
                Edit role
              </Link>
            </div>
          </div>

          {/* Zone C — overflow */}
          <div style={{ position: 'relative', flexShrink: 0, alignSelf: 'flex-end' }}>
            <button className="btn-ghost btn-sm" onClick={() => setZoneCOpen(v => !v)}>
              More ▾
            </button>
            {zoneCOpen && (
              <RoleZoneCMenu
                role={role}
                onClose={() => setZoneCOpen(false)}
                onConfirmClose={() => { setConfirmClose(true); setZoneCOpen(false) }}
                onDelete={handleDelete}
              />
            )}
          </div>
        </div>

        {/* Zone B — generate */}
        <div className="zone-b" style={{ marginTop: 12 }}>
          <span className="zone-label">Generate</span>
          <div className="zone-b-actions">
            <button
              className="btn-ghost btn-sm"
              onClick={handleBuildSearchStrings}
              disabled={searchGenerating}
            >
              {searchGenerating ? 'Building…' : searchStrings ? 'Rebuild strings' : 'Build search strings'}
            </button>
            <button
              className="btn-ghost btn-sm"
              onClick={handleGenerateInterviewQuestions}
              disabled={interviewGenerating}
            >
              {interviewGenerating ? 'Generating…' : interviewQuestions ? 'Regenerate IQ' : 'Interview questions'}
            </button>
          </div>
        </div>
      </div>

      {/* Close role confirm */}
      {confirmClose && (
        <div className="inline-confirm" style={{ marginBottom: 16 }}>
          <span>{role.status === 'filled' ? 'Reopen this role?' : 'Mark as filled?'}</span>
          <button className="btn-confirm-yes" onClick={handleCloseRole} disabled={closing}>
            {closing ? 'Saving…' : 'Yes'}
          </button>
          <button className="btn-confirm-cancel" onClick={() => setConfirmClose(false)}>Cancel</button>
        </div>
      )}
      {closeError && <p className="inline-error" style={{ marginBottom: 16 }}>{closeError}</p>}

      {/* Pipeline board */}
      {stages.length === 0 ? (
        <p className="muted" style={{ marginBottom: 32 }}>
          No hiring stages defined.{' '}
          <Link to={`/roles/${id}/edit`} style={{ color: 'var(--color-accent)' }}>
            Edit this role
          </Link>{' '}
          to add stages.
        </p>
      ) : (
        <div className="pipeline-board">
          {stages.map(stage => (
            <PipelineColumn
              key={stage}
              stage={stage}
              entries={byStage[stage] ?? []}
              advancingId={advancingId}
              stages={stages}
              onAdvance={handleAdvanceStage}
              onGoBack={handleGoBackStage}
              onDraftSubmission={handleDraftSubmission}
              onRemove={handleRemoveFromPipeline}
            />
          ))}
        </div>
      )}

      {/* Network match suggestions (stub) */}
      <NetworkMatchStub />

      {/* Boolean Search Strings */}
      <section className="candidate-section" style={{ marginTop: 32 }}>
        <div className="section-heading-row">
          <h2 className="section-heading">Search Strings</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {searchStrings && !clearSearchConfirm && (
              <button className="btn-ghost btn-sm" onClick={() => setClearSearchConfirm(true)}>Clear</button>
            )}
            <button
              className="btn-ghost btn-sm"
              onClick={handleBuildSearchStrings}
              disabled={searchGenerating}
            >
              {searchGenerating ? 'Building…' : searchStrings ? 'Rebuild' : 'Build Search Strings'}
            </button>
          </div>
        </div>

        {clearSearchConfirm && (
          <div className="inline-confirm">
            <span>Clear search strings?</span>
            <button className="btn-confirm-yes" onClick={handleClearSearchStrings}>Yes, clear</button>
            <button className="btn-confirm-cancel" onClick={() => setClearSearchConfirm(false)}>Cancel</button>
          </div>
        )}
        {searchGenerating && (
          <div className="modal-generating"><div className="spinner spinner--sm" />Building search strings…</div>
        )}
        {searchError && (
          <p className="error" style={{ marginTop: 8 }}>Couldn't build search strings. Try again.</p>
        )}
        {searchStrings && (
          <div className="search-strings">
            {[
              { key: 'linkedin', label: 'LinkedIn' },
              { key: 'google',   label: 'Google X-Ray' },
              { key: 'github',   label: 'GitHub' },
            ].map(({ key, label }) => searchStrings[key] ? (
              <div key={key} className="search-string-block">
                <div className="search-string-header">
                  <p className="search-string-label">{label}</p>
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => navigator.clipboard.writeText(searchStrings[key])}
                  >Copy</button>
                </div>
                <p className="search-string-value">{searchStrings[key]}</p>
              </div>
            ) : null)}
          </div>
        )}
      </section>

      {/* Interview Questions */}
      <section className="candidate-section" style={{ marginTop: 32 }}>
        <div className="section-heading-row">
          <h2 className="section-heading">Interview Questions</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {interviewQuestions && !clearInterviewConfirm && (
              <>
                <button className="btn-ghost btn-sm" onClick={() => setClearInterviewConfirm(true)}>Clear</button>
                <button
                  className="btn-ghost btn-sm"
                  onClick={handleSaveInterviewGuide}
                  disabled={interviewGuideSaving || interviewGuideSaved}
                >
                  {interviewGuideSaving ? 'Saving…' : interviewGuideSaved ? 'Saved ✓' : 'Save Guide'}
                </button>
              </>
            )}
            <button
              className="btn-ghost btn-sm"
              onClick={handleGenerateInterviewQuestions}
              disabled={interviewGenerating}
            >
              {interviewGenerating ? 'Generating…' : interviewQuestions ? 'Regenerate' : 'Generate'}
            </button>
          </div>
        </div>

        {clearInterviewConfirm && (
          <div className="inline-confirm">
            <span>Clear interview questions?</span>
            <button className="btn-confirm-yes" onClick={handleClearInterviewQuestions}>Yes, clear</button>
            <button className="btn-confirm-cancel" onClick={() => setClearInterviewConfirm(false)}>Cancel</button>
          </div>
        )}
        {interviewGenerating && (
          <div className="modal-generating"><div className="spinner spinner--sm" />Generating questions…</div>
        )}
        {interviewError && (
          <p className="error" style={{ marginTop: 8 }}>Couldn't generate questions. Try again.</p>
        )}
        {interviewQuestions && (
          <div className="interview-questions">
            <div className="interview-section">
              <h3 className="interview-section-heading">Behavioral</h3>
              <ol className="interview-list">
                {interviewQuestions.behavioral?.map((q, i) => (
                  <li key={i} className="interview-item">
                    <p className="interview-question">{q.question}</p>
                    <p className="interview-signal">{q.signal}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div className="interview-section">
              <h3 className="interview-section-heading">Technical / Role-Specific</h3>
              <ol className="interview-list">
                {interviewQuestions.technical?.map((q, i) => (
                  <li key={i} className="interview-item">
                    <p className="interview-question">{q.question}</p>
                    <p className="interview-signal">{q.signal}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </section>

      {/* Job Description */}
      {(rawJd || jdToShow) && (
        <section className="role-jd-section">
          <div className="section-heading-row">
            <h2 className="section-heading">Job Description</h2>
            {jdAutoFormatting && (
              <span className="muted" style={{ fontSize: 12 }}>Formatting…</span>
            )}
          </div>
          {jdToShow ? (
            <>
              <p className="role-jd-body">{jdToShow}</p>
              {rawJd && rawJd !== jdToShow && (
                <details style={{ marginTop: 12 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--color-muted)', userSelect: 'none' }}>
                    View raw JD
                  </summary>
                  <p className="role-jd-body" style={{ marginTop: 8, opacity: 0.65 }}>{rawJd}</p>
                </details>
              )}
            </>
          ) : (
            <p className="role-jd-body">{rawJd}</p>
          )}
        </section>
      )}

      {/* Submission draft modal */}
      {draftModal.open && (
        <div className="modal-overlay" onClick={closeDraftModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Submission Draft</h2>
                <p className="modal-subtitle">{draftModal.candidateName} — {role.title}</p>
              </div>
              <button className="modal-close" onClick={closeDraftModal}>✕</button>
            </div>

            {(draftModal.phase === 'pick' || draftModal.phase === 'done') && (
              <div className="format-toggle">
                <button
                  className={`format-toggle-btn${draftModal.format === 'email' ? ' format-toggle-btn--active' : ''}`}
                  onClick={() => setDraftModal(prev => ({ ...prev, format: 'email' }))}
                >Email</button>
                <button
                  className={`format-toggle-btn${draftModal.format === 'bullet' ? ' format-toggle-btn--active' : ''}`}
                  onClick={() => setDraftModal(prev => ({ ...prev, format: 'bullet' }))}
                >Bullet</button>
              </div>
            )}

            {draftModal.phase === 'pick' && (
              <div className="modal-actions">
                <button className="btn-primary" onClick={handleGenerate}>Generate</button>
                <button className="btn-ghost" onClick={closeDraftModal}>Cancel</button>
              </div>
            )}
            {draftModal.phase === 'generating' && (
              <div className="modal-generating">
                <div className="spinner spinner--sm" />Drafting submission…
              </div>
            )}
            {draftModal.phase === 'error' && (
              <p className="error" style={{ marginTop: 8 }}>Couldn't generate submission. Try again.</p>
            )}
            {draftModal.phase === 'done' && (
              <>
                <textarea
                  ref={textareaRef}
                  className="submission-textarea"
                  value={draftModal.text}
                  onChange={e => setDraftModal(prev => ({ ...prev, text: e.target.value }))}
                  rows={12}
                />
                <div className="modal-actions">
                  <button
                    className="btn-primary"
                    onClick={handleSaveToQueue}
                    disabled={savingToQueue || savedToQueue}
                  >
                    {savedToQueue ? 'Saved ✓' : savingToQueue ? 'Saving…' : 'Save to Queue'}
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => { navigator.clipboard.writeText(draftModal.text); textareaRef.current?.select() }}
                  >Copy</button>
                  <button className="btn-ghost" onClick={handleGenerate}>Regenerate</button>
                  <button className="btn-ghost" onClick={closeDraftModal}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </AppLayout>
  )
}
