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
  open:              'Open',
  on_hold:           'On Hold',
  filled:            'Filled',
  cancelled:         'Cancelled',
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
    : min
      ? `${fmt(min)}+`
      : `Up to ${fmt(max)}`
  return `${range}${COMP_TYPE_SUFFIXES[type] ?? ''}`
}

// ── Sub-components ────────────────────────────────────────

function fitScoreClass(score) {
  if (score == null) return ''
  if (score >= 70) return 'kcard-score--green'
  if (score >= 40) return 'kcard-score--amber'
  return 'kcard-score--red'
}

function PipelineCandidate({ entry, onAdvance, onGoBack, onDraftSubmission, onRemove, advancing }) {
  const uClass = urgencyClass(entry.next_action_due_at)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState(null)

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
  const signal = entry.fit_score_rationale
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
          onClick={e => { e.preventDefault(); onDraftSubmission(entry) }}
          title="Draft submission"
        >✉</button>
        {onGoBack && (
          <button
            className="btn-go-back-stage"
            onClick={e => { e.preventDefault(); onGoBack(entry) }}
            title="Move back a stage"
            disabled={advancing}
          >{advancing ? '…' : '←'}</button>
        )}
        {onAdvance && (
          <button
            className="btn-advance-stage"
            onClick={e => { e.preventDefault(); onAdvance(entry) }}
            title="Advance to next stage"
            disabled={advancing}
          >{advancing ? '…' : '→'}</button>
        )}
        <button
          className="btn-kanban-remove"
          onClick={e => { e.preventDefault(); setConfirmRemove(true) }}
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
  const nextStage = stages[currentIndex + 1] ?? null
  const prevStage = stages[currentIndex - 1] ?? null
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
  const { id } = useParams()
  const navigate = useNavigate()
  const { recruiter } = useRecruiter()

  const [role, setRole] = useState(null)
  const [pipeline, setPipeline] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [fetchError, setFetchError] = useState(null)
  const [deleting, setDeleting]         = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [closing, setClosing]           = useState(false)
  const [closeError, setCloseError]     = useState(null)
  const [advancingId, setAdvancingId]   = useState(null)

  // Interview questions
  const [interviewQuestions, setInterviewQuestions] = useState(null)
  const [interviewGenerating, setInterviewGenerating] = useState(false)
  const [interviewError, setInterviewError] = useState(null)
  const [interviewGuideSaving, setInterviewGuideSaving] = useState(false)
  const [interviewGuideSaved, setInterviewGuideSaved] = useState(false)

  // Boolean search strings
  const [searchStrings, setSearchStrings] = useState(null)
  const [searchGenerating, setSearchGenerating] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [clearSearchConfirm, setClearSearchConfirm] = useState(false)

  // Interview questions clear confirm
  const [clearInterviewConfirm, setClearInterviewConfirm] = useState(false)

  // JD formatting
  const [jdFormatting, setJdFormatting] = useState(false)
  const [jdFormatError, setJdFormatError] = useState(null)

  // Submission draft modal
  const [draftModal, setDraftModal] = useState({
    open: false,
    phase: 'pick',   // 'pick' | 'generating' | 'done' | 'error'
    format: 'email', // 'email' | 'bullet'
    text: '',
    error: null,
    candidateName: '',
    candidateId: null,
    fitScore: null,
  })
  const [savingToQueue, setSavingToQueue] = useState(false)
  const [savedToQueue, setSavedToQueue] = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (!id || !recruiter?.id) return

    async function fetchRole() {
      const [roleRes, pipelineRes] = await Promise.all([
        supabase
          .from('roles')
          .select('id, title, status, comp_min, comp_max, comp_type, comp_currency, process_steps, notes, search_strings, interview_guide, clients(name)')
          .eq('id', id)
          .eq('recruiter_id', recruiter.id)
          .single(),

        supabase
          .from('pipeline')
          .select('id, current_stage, fit_score, fit_score_rationale, next_action, next_action_due_at, candidate_id, recruiter_score, recruiter_note, candidates(id, first_name, last_name, current_title)')
          .eq('role_id', id)
          .eq('status', 'active'),
      ])

      if (roleRes.error) {
        // PGRST116 = no rows returned (genuine 404). Anything else = query/RLS/network error.
        console.error('[RoleDetail] fetch error:', roleRes.error.code, roleRes.error.message)
        if (roleRes.error.code === 'PGRST116') {
          setNotFound(true)
        } else {
          setFetchError(roleRes.error.message ?? 'Couldn\'t load this role.')
        }
      } else if (!roleRes.data) {
        setNotFound(true)
      } else {
        setRole(roleRes.data)
        setPipeline(pipelineRes.data ?? [])
        if (roleRes.data.search_strings) {
          setSearchStrings(roleRes.data.search_strings)
        }
        if (roleRes.data.interview_guide) {
          setInterviewQuestions(roleRes.data.interview_guide)
        }
      }

      setLoading(false)
    }

    fetchRole()
  }, [id, recruiter?.id])

  async function handleCloseRole() {
    setClosing(true)
    setCloseError(null)
    const newStatus = role.status === 'filled' ? 'open' : 'filled'
    const { error } = await supabase
      .from('roles')
      .update({ status: newStatus })
      .eq('id', id)
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
          <p className="page-error-body">This role may have been deleted or you may not have access.</p>
          <button className="btn-ghost" onClick={() => navigate('/roles')}>Back to Roles</button>
        </div>
      </AppLayout>
    )
  }

  const comp = formatComp(role.comp_min, role.comp_max, role.comp_type)
  const stages = role.process_steps ?? []

  // Group pipeline entries by stage
  const byStage = Object.fromEntries(stages.map(s => [s, []]))
  for (const entry of pipeline) {
    if (byStage[entry.current_stage] !== undefined) {
      byStage[entry.current_stage].push(entry)
    }
  }

  function handleDraftSubmission(entry) {
    const candidateName = `${entry.candidates.first_name} ${entry.candidates.last_name}`
    setDraftModal({
      open: true,
      phase: 'pick',
      format: 'email',
      text: '',
      error: null,
      candidateName,
      candidateId: entry.candidate_id,
      fitScore: entry.fit_score,
    })
    setSavedToQueue(false)
  }

  async function handleGenerate() {
    const { candidateId, fitScore, format } = draftModal
    setDraftModal(prev => ({ ...prev, phase: 'generating', text: '', error: null }))
    setSavedToQueue(false)

    try {
      const { data: candidate, error: candidateErr } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', candidateId)
        .single()

      if (candidateErr || !candidate) throw new Error('Could not load candidate data.')

      const messages = buildSubmissionMessages(candidate, role, fitScore, format)
      const text = await generateText({ messages, maxTokens: 1024 })
      setDraftModal(prev => ({ ...prev, phase: 'done', text }))
    } catch (err) {
      setDraftModal(prev => ({ ...prev, phase: 'error', error: err.message ?? 'Generation failed.' }))
    }
  }

  function closeDraftModal() {
    setDraftModal({ open: false, phase: 'pick', format: 'email', text: '', error: null, candidateName: '', candidateId: null, fitScore: null })
    setSavedToQueue(false)
  }

  async function handleSaveToQueue() {
    if (!draftModal.text || savingToQueue) return
    setSavingToQueue(true)
    const subject = `${draftModal.candidateName} — ${role.title}${role.clients?.name ? ` at ${role.clients.name}` : ''}`
    const { error } = await supabase.from('messages').insert({
      recruiter_id:  recruiter.id,
      candidate_id:  draftModal.candidateId,
      channel:       'email',
      subject,
      body:          draftModal.text,
      status:        'drafted',
    })
    if (error) {
      console.error('save to queue failed:', error)
    } else {
      setSavedToQueue(true)
    }
    setSavingToQueue(false)
  }

  async function handleBuildSearchStrings() {
    setSearchStrings(null)
    setSearchError(null)
    setSearchGenerating(true)
    try {
      const messages = buildBooleanSearchMessages(role)
      const raw = await generateText({ messages, maxTokens: 1024 })
      const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
      const result = JSON.parse(cleaned)
      setSearchStrings(result)
      // Persist to DB (silently fails if column doesn't exist yet)
      supabase.from('roles').update({ search_strings: result }).eq('id', id).then(({ error }) => {
        if (error) console.warn('search_strings save failed (column may not exist yet):', error.message)
      })
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
      const raw = await generateText({ messages, maxTokens: 2048 })
      const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
      const result = JSON.parse(cleaned)
      setInterviewQuestions(result)
    } catch (err) {
      setInterviewError(err.message ?? 'Failed to generate questions.')
    } finally {
      setInterviewGenerating(false)
    }
  }

  async function handleAdvanceStage(entry) {
    if (advancingId) return
    const currentIndex = stages.indexOf(entry.current_stage)
    const nextStage = stages[currentIndex + 1]
    if (!nextStage) return
    setAdvancingId(entry.id)
    setPipeline(prev => prev.map(p =>
      p.id === entry.id ? { ...p, current_stage: nextStage } : p
    ))
    const { error } = await supabase
      .from('pipeline')
      .update({ current_stage: nextStage })
      .eq('id', entry.id)
    if (error) {
      console.error('advance stage failed:', error)
      setPipeline(prev => prev.map(p =>
        p.id === entry.id ? { ...p, current_stage: entry.current_stage } : p
      ))
    }
    setAdvancingId(null)
  }

  async function handleGoBackStage(entry) {
    if (advancingId) return
    const currentIndex = stages.indexOf(entry.current_stage)
    const prevStage = stages[currentIndex - 1]
    if (!prevStage) return
    setAdvancingId(entry.id)
    setPipeline(prev => prev.map(p =>
      p.id === entry.id ? { ...p, current_stage: prevStage } : p
    ))
    const { error } = await supabase
      .from('pipeline')
      .update({ current_stage: prevStage })
      .eq('id', entry.id)
    if (error) {
      console.error('go back stage failed:', error)
      setPipeline(prev => prev.map(p =>
        p.id === entry.id ? { ...p, current_stage: entry.current_stage } : p
      ))
    }
    setAdvancingId(null)
  }

  async function handleRemoveFromPipeline(pipelineId) {
    const { error } = await supabase.from('pipeline').delete().eq('id', pipelineId)
    if (error) return error
    setPipeline(prev => prev.filter(p => p.id !== pipelineId))
    return null
  }

  async function handleClearSearchStrings() {
    const { error } = await supabase.from('roles').update({ search_strings: null }).eq('id', id)
    if (!error) setSearchStrings(null)
    setClearSearchConfirm(false)
  }

  async function handleClearInterviewQuestions() {
    setInterviewQuestions(null)
    setInterviewGuideSaved(false)
    setClearInterviewConfirm(false)
    await supabase.from('roles').update({ interview_guide: null }).eq('id', id)
  }

  async function handleFormatJd() {
    if (!role?.notes) return
    setJdFormatting(true)
    setJdFormatError(null)
    try {
      const formatted = await generateText({
        system: 'You are a recruiting assistant. Clean up the job description text below. Remove HTML tags, excessive whitespace, broken line breaks, and formatting artifacts. Preserve all meaningful content: responsibilities, requirements, compensation, company info. Return plain text only. No markdown, no explanation.',
        messages: [{ role: 'user', content: role.notes }],
        maxTokens: 2048,
      })
      const { error } = await supabase
        .from('roles')
        .update({ notes: formatted.trim() })
        .eq('id', id)
      if (error) throw new Error(error.message)
      setRole(prev => ({ ...prev, notes: formatted.trim() }))
    } catch (err) {
      setJdFormatError(err.message ?? 'Format failed. Try again.')
    } finally {
      setJdFormatting(false)
    }
  }

  async function handleSaveInterviewGuide() {
    if (!interviewQuestions) return
    setInterviewGuideSaving(true)
    setInterviewGuideSaved(false)
    const { error } = await supabase
      .from('roles')
      .update({ interview_guide: interviewQuestions })
      .eq('id', id)
    if (error) console.warn('interview_guide save failed (column may not exist yet):', error.message)
    setInterviewGuideSaving(false)
    if (!error) setInterviewGuideSaved(true)
  }

  return (
    <AppLayout>

      {/* Role header */}
      <div className="role-detail-header">
        <div className="role-detail-header-left">
          <button className="btn-back" onClick={() => navigate('/roles')}>← Back</button>
          <div>
            <div className="role-detail-title-row">
              <h1 className="page-title">{role.title}</h1>
              <span className={`role-status-badge role-status-badge--${role.status}`}>
                {STATUS_LABELS[role.status] ?? role.status}
              </span>
            </div>
            <p className="page-subtitle">
              {role.clients?.name ?? '—'}
              {comp && <span className="role-detail-comp"> · {comp}</span>}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to={`/roles/${id}/edit`} className="btn-ghost">Edit</Link>
            {role.status === 'filled' ? (
              <button className="btn-ghost" onClick={handleCloseRole} disabled={closing}>
                {closing ? 'Reopening…' : 'Reopen'}
              </button>
            ) : confirmClose ? (
              <div className="inline-confirm">
                <span>Mark as filled?</span>
                <button className="btn-confirm-yes" onClick={handleCloseRole} disabled={closing}>
                  {closing ? 'Saving…' : 'Yes'}
                </button>
                <button className="btn-confirm-cancel" onClick={() => setConfirmClose(false)}>Cancel</button>
              </div>
            ) : (
              <button className="btn-ghost" onClick={() => setConfirmClose(true)}>
                Close Role
              </button>
            )}
            <button className="btn-ghost btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
          {closeError && <p className="inline-error" style={{ margin: 0 }}>{closeError}</p>}
        </div>
      </div>

      {/* Pipeline board */}
      {stages.length === 0 ? (
        <p className="muted" style={{ marginBottom: 32 }}>No hiring stages defined. Edit this role to add stages.</p>
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
          <div className="modal-generating">
            <div className="spinner spinner--sm" />
            Building search strings…
          </div>
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
                  {interviewGuideSaving ? 'Saving…' : interviewGuideSaved ? 'Saved' : 'Save Guide'}
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
          <div className="modal-generating">
            <div className="spinner spinner--sm" />
            Generating questions…
          </div>
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

      {/* Job description */}
      {role.notes && (
        <section className="role-jd-section">
          <div className="section-heading-row">
            <h2 className="section-heading">Job Description</h2>
            <button
              className="btn-ghost btn-sm"
              onClick={handleFormatJd}
              disabled={jdFormatting}
            >
              {jdFormatting ? 'Formatting…' : 'Format'}
            </button>
          </div>
          {jdFormatError && (
            <p className="error" style={{ marginTop: 4, marginBottom: 8 }}>{jdFormatError}</p>
          )}
          <p className="role-jd-body">{role.notes}</p>
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

            {/* Format toggle — visible in pick and done phases */}
            {(draftModal.phase === 'pick' || draftModal.phase === 'done') && (
              <div className="format-toggle">
                <button
                  className={`format-toggle-btn${draftModal.format === 'email' ? ' format-toggle-btn--active' : ''}`}
                  onClick={() => setDraftModal(prev => ({ ...prev, format: 'email' }))}
                >
                  Email
                </button>
                <button
                  className={`format-toggle-btn${draftModal.format === 'bullet' ? ' format-toggle-btn--active' : ''}`}
                  onClick={() => setDraftModal(prev => ({ ...prev, format: 'bullet' }))}
                >
                  Bullet
                </button>
              </div>
            )}

            {draftModal.phase === 'pick' && (
              <div className="modal-actions">
                <button className="btn-primary" onClick={handleGenerate}>
                  Generate
                </button>
                <button className="btn-ghost" onClick={closeDraftModal}>Cancel</button>
              </div>
            )}

            {draftModal.phase === 'generating' && (
              <div className="modal-generating">
                <div className="spinner spinner--sm" />
                Drafting submission…
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
                    onClick={() => {
                      navigator.clipboard.writeText(draftModal.text)
                      textareaRef.current?.select()
                    }}
                  >
                    Copy
                  </button>
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
