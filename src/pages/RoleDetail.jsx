import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useRecruiter } from '../hooks/useRecruiter'
import { supabase } from '../lib/supabase'
import { generateText } from '../lib/ai'
import { buildSubmissionMessages } from '../lib/prompts/submissionDraft'
import { buildInterviewQuestionMessages } from '../lib/prompts/interviewQuestionGenerator'
import { buildBooleanSearchMessages } from '../lib/prompts/booleanSearchBuilder'
import { urgencyClass } from '../lib/urgency'
import { useAgent } from '../context/AgentContext'

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
  if (role.placement_fee_pct) return `${parseFloat((role.placement_fee_pct * 100).toFixed(4))}% fee`
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
    pills.push({ label: 'Fee not set', variant: 'amber', key: 'fee_not_set', clickable: true })
  }
  const agreementStatus = role.agreement_status ?? 'missing'
  if (agreementStatus === 'missing') {
    pills.push({ label: 'Agreement missing', variant: 'gray', key: 'agreement_missing', clickable: true })
  } else if (agreementStatus === 'uploaded') {
    pills.push({ label: 'Agreement: uploaded', variant: 'green', key: 'agreement_uploaded', clickable: false })
  } else if (agreementStatus === 'external') {
    const extLabel = role.agreement_external_label || 'external'
    pills.push({ label: `Agreement: ${extLabel}`, variant: 'green', key: 'agreement_external', clickable: false })
  }
  // 'not_applicable' → pill hidden
  if (pipeline.length > 0) {
    const INTERVIEWED_STAGES = new Set(['interviewing', 'offer', 'placed'])
    const hasInterview = pipeline.some(e => INTERVIEWED_STAGES.has(e.current_stage?.toLowerCase()))
    if (!hasInterview) pills.push({ label: 'No interviews', variant: 'amber', key: 'no_interviews', clickable: true })
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

function RoleStatusBar({ role, pipeline, onBack, healthPills, nextAction, onPillClick }) {
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
              p.clickable
                ? <button
                    key={p.key ?? p.label}
                    className={`risk-pill risk-pill--${p.variant} risk-pill--clickable`}
                    onClick={() => onPillClick?.(p.key)}
                  >{p.label}</button>
                : <span key={p.key ?? p.label} className={`risk-pill risk-pill--${p.variant}`}>{p.label}</span>
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
      <Link to={`/network/${entry.candidate_id}`} className="pipeline-candidate-info">
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

export default function RoleDetail({ id: idProp, onClose }) {
  const { id: paramId } = useParams()
  const id              = idProp ?? paramId
  const navigate        = useNavigate()
  const { recruiter }   = useRecruiter()
  const { fireResponse, registerAction, unregisterAction } = useAgent()

  const [role, setRole]           = useState(null)
  const [pipeline, setPipeline]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [notFound, setNotFound]   = useState(false)
  const [fetchError, setFetchError] = useState(null)

  // Health signal state (secondary fetch)
  const [lastStageMoveDays, setLastStageMoveDays]         = useState(null)
  const [lastInteractionDays, setLastInteractionDays]     = useState(null)

  // Pill panels
  const [activePill, setActivePill]           = useState(null) // 'fee_not_set' | 'agreement_missing' | 'no_interviews'
  const [feePanelType, setFeePanelType]       = useState('pct')
  const [feePanelValue, setFeePanelValue]     = useState('')
  const [feePanelSaving, setFeePanelSaving]   = useState(false)
  const [feePanelError, setFeePanelError]     = useState(null)
  const [agmtOption, setAgmtOption]           = useState('upload') // 'upload' | 'external' | 'not_applicable'
  const [agmtFile, setAgmtFile]               = useState(null)
  const [agmtLabel, setAgmtLabel]             = useState('')
  const [agmtUrl, setAgmtUrl]                 = useState('')
  const [agmtSaving, setAgmtSaving]           = useState(false)
  const [agmtError, setAgmtError]             = useState(null)

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
            agreement_id, agreement_status, agreement_external_label, agreement_external_url,
            client_id, created_at,
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
    const pipelineIds = pipeData.map(e => e.id).filter(Boolean)
    const promises = [
      pipelineIds.length > 0
        ? supabase
            .from('pipeline_stage_history')
            .select('entered_at')
            .in('pipeline_id', pipelineIds)
            .order('entered_at', { ascending: false })
            .limit(1)
        : Promise.resolve({ data: [] }),
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
      const days = Math.floor((Date.now() - new Date(histRes.value.data[0].entered_at)) / 86_400_000)
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

  // Register page-level action handlers so suggestion chips work while on this page
  useEffect(() => {
    registerAction('add_fee', () => setActivePill('fee_not_set'))
    registerAction('build_search_strings', handleBuildSearchStrings)
    return () => {
      unregisterAction('add_fee')
      unregisterAction('build_search_strings')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerAction, unregisterAction])

  // ── Pill panel handlers ──────────────────────────────────

  function handlePillClick(pillKey) {
    setActivePill(prev => prev === pillKey ? null : pillKey)
    setFeePanelError(null)
    setAgmtError(null)
    if (pillKey === 'no_interviews') {
      setActivePill(null)
      fireResponse('no_interviews_scheduled', {
        role: { id, title: role.title, company: role.clients?.name },
        pipeline_count: pipeline.length,
      })
    }
  }

  async function handleFeeSave() {
    if (!feePanelValue) return
    setFeePanelSaving(true)
    setFeePanelError(null)
    try {
      const update = feePanelType === 'pct'
        ? { placement_fee_pct: Number(feePanelValue) / 100, placement_fee_flat: null }
        : { placement_fee_flat: Number(feePanelValue), placement_fee_pct: null }
      const { error } = await supabase.from('roles').update(update).eq('id', id)
      if (error) throw error
      setRole(prev => ({ ...prev, ...update }))
      setActivePill(null)
      setFeePanelValue('')
    } catch {
      setFeePanelError('Save failed. Try again.')
    } finally {
      setFeePanelSaving(false)
    }
  }

  async function handleAgreementSave() {
    setAgmtSaving(true)
    setAgmtError(null)
    try {
      let update = {}
      if (agmtOption === 'not_applicable') {
        update = { agreement_status: 'not_applicable' }
      } else if (agmtOption === 'external') {
        if (!agmtLabel.trim()) { setAgmtError('Label is required.'); setAgmtSaving(false); return }
        update = {
          agreement_status: 'external',
          agreement_external_label: agmtLabel.trim(),
          agreement_external_url: agmtUrl.trim() || null,
        }
      } else if (agmtOption === 'upload') {
        if (!agmtFile) { setAgmtError('Select a file to upload.'); setAgmtSaving(false); return }
        const filePath = `agreements/${recruiter.id}/${id}/${agmtFile.name}`
        const { error: uploadError } = await supabase.storage
          .from('agreements')
          .upload(filePath, agmtFile, { upsert: true })
        if (uploadError) throw uploadError
        update = { agreement_status: 'uploaded' }
      }
      const { error } = await supabase.from('roles').update(update).eq('id', id)
      if (error) throw error
      setRole(prev => ({ ...prev, ...update }))
      setActivePill(null)
      setAgmtFile(null)
      setAgmtLabel('')
      setAgmtUrl('')
    } catch (err) {
      setAgmtError(err.message ?? 'Save failed. Try again.')
    } finally {
      setAgmtSaving(false)
    }
  }

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
    if (onClose) onClose(); else navigate('/roles')
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

  const isPanel = Boolean(onClose)

  if (loading) {
    const s = <div className="loading-state"><div className="spinner" /></div>
    return isPanel ? s : <AppLayout>{s}</AppLayout>
  }

  if (fetchError) {
    const s = (
      <div className="page-error">
        <p className="page-error-title">Couldn't load this role.</p>
        <p className="page-error-body">Check the browser console for details, then try refreshing.</p>
        <button className="btn-ghost" onClick={() => onClose ? onClose() : navigate('/roles')}>
          {isPanel ? 'Close' : 'Back to Roles'}
        </button>
      </div>
    )
    return isPanel ? s : <AppLayout>{s}</AppLayout>
  }

  if (notFound) {
    const s = (
      <div className="page-error">
        <p className="page-error-title">Role not found.</p>
        <button className="btn-ghost" onClick={() => onClose ? onClose() : navigate('/roles')}>
          {isPanel ? 'Close' : 'Back to Roles'}
        </button>
      </div>
    )
    return isPanel ? s : <AppLayout>{s}</AppLayout>
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

  const __body = (
    <>

      {/* Sticky Role Status Bar */}
      <RoleStatusBar
        role={role}
        pipeline={pipeline}
        onBack={() => onClose ? onClose() : navigate('/roles')}
        healthPills={healthPills}
        nextAction={nextAction}
        onPillClick={handlePillClick}
      />

      {/* Pill panels — inline, below status bar */}
      {activePill === 'fee_not_set' && (
        <div className="pill-panel" style={{ marginBottom: 16 }}>
          <p className="pill-panel-title">Set fee</p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
              <input type="radio" name="fee-type" value="pct" checked={feePanelType === 'pct'} onChange={() => setFeePanelType('pct')} />
              % of comp
            </label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
              <input type="radio" name="fee-type" value="flat" checked={feePanelType === 'flat'} onChange={() => setFeePanelType('flat')} />
              Flat fee ($)
            </label>
            <input
              className="inline-input"
              type="number"
              placeholder={feePanelType === 'pct' ? '20' : '25000'}
              value={feePanelValue}
              onChange={e => setFeePanelValue(e.target.value)}
              style={{ width: 100 }}
            />
            {feePanelType === 'pct' && <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>%</span>}
            <button className="btn-primary btn-sm" onClick={handleFeeSave} disabled={feePanelSaving || !feePanelValue}>
              {feePanelSaving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setActivePill(null)}>Cancel</button>
          </div>
          {feePanelError && <p className="inline-error" style={{ marginTop: 6 }}>{feePanelError}</p>}
        </div>
      )}

      {activePill === 'agreement_missing' && (
        <div className="pill-panel" style={{ marginBottom: 16 }}>
          <p className="pill-panel-title">Agreement</p>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            {[
              { value: 'upload',         label: 'Upload PDF' },
              { value: 'external',       label: 'Hosted elsewhere' },
              { value: 'not_applicable', label: 'Not applicable' },
            ].map(opt => (
              <label key={opt.value} style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                <input type="radio" name="agmt-option" value={opt.value} checked={agmtOption === opt.value} onChange={() => setAgmtOption(opt.value)} />
                {opt.label}
              </label>
            ))}
          </div>
          {agmtOption === 'upload' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="file" accept=".pdf" onChange={e => setAgmtFile(e.target.files[0] ?? null)} />
            </div>
          )}
          {agmtOption === 'external' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                className="inline-input"
                type="text"
                placeholder="Label (e.g. Paraform)"
                value={agmtLabel}
                onChange={e => setAgmtLabel(e.target.value)}
                style={{ width: 180 }}
              />
              <input
                className="inline-input"
                type="url"
                placeholder="URL (optional)"
                value={agmtUrl}
                onChange={e => setAgmtUrl(e.target.value)}
                style={{ width: 220 }}
              />
            </div>
          )}
          {agmtOption === 'not_applicable' && (
            <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 8 }}>
              The agreement pill will be hidden for this role.
            </p>
          )}
          {agmtError && <p className="inline-error" style={{ marginTop: 6 }}>{agmtError}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn-primary btn-sm" onClick={handleAgreementSave} disabled={agmtSaving}>
              {agmtSaving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setActivePill(null)}>Cancel</button>
          </div>
        </div>
      )}

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

          {/* Search strings — inline result */}
          {(searchGenerating || searchError || searchStrings) && (
            <div style={{ marginTop: 12 }}>
              {searchGenerating && (
                <div className="modal-generating"><div className="spinner spinner--sm" />Building search strings…</div>
              )}
              {searchError && <p className="error" style={{ marginTop: 8 }}>Couldn't build search strings. Try again.</p>}
              {searchStrings && !searchGenerating && (
                <>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    {clearSearchConfirm ? (
                      <div className="inline-confirm">
                        <span>Clear search strings?</span>
                        <button className="btn-confirm-yes" onClick={handleClearSearchStrings}>Yes, clear</button>
                        <button className="btn-confirm-cancel" onClick={() => setClearSearchConfirm(false)}>Cancel</button>
                      </div>
                    ) : (
                      <button className="btn-ghost btn-sm" onClick={() => setClearSearchConfirm(true)}>Clear</button>
                    )}
                  </div>
                  <div className="search-strings">
                    {[
                      { key: 'linkedin', label: 'LinkedIn' },
                      { key: 'google',   label: 'Google X-Ray' },
                      { key: 'github',   label: 'GitHub' },
                    ].map(({ key, label }) => searchStrings[key] ? (
                      <div key={key} className="search-string-block">
                        <div className="search-string-header">
                          <p className="search-string-label">{label}</p>
                          <button className="btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(searchStrings[key])}>Copy</button>
                        </div>
                        <p className="search-string-value">{searchStrings[key]}</p>
                      </div>
                    ) : null)}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Interview questions — inline result */}
          {(interviewGenerating || interviewError || interviewQuestions) && (
            <div style={{ marginTop: 12 }}>
              {interviewGenerating && (
                <div className="modal-generating"><div className="spinner spinner--sm" />Generating questions…</div>
              )}
              {interviewError && <p className="error" style={{ marginTop: 8 }}>Couldn't generate questions. Try again.</p>}
              {interviewQuestions && !interviewGenerating && (
                <>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    {clearInterviewConfirm ? (
                      <div className="inline-confirm">
                        <span>Clear interview questions?</span>
                        <button className="btn-confirm-yes" onClick={handleClearInterviewQuestions}>Yes, clear</button>
                        <button className="btn-confirm-cancel" onClick={() => setClearInterviewConfirm(false)}>Cancel</button>
                      </div>
                    ) : (
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
                  </div>
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
                </>
              )}
            </div>
          )}
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

    </>
  )
  return isPanel ? __body : <AppLayout>{__body}</AppLayout>
}
