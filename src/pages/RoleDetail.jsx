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

function PipelineCandidate({ entry, onAdvance, onGoBack, onDraftSubmission }) {
  const uClass = urgencyClass(entry.next_action_due_at)
  return (
    <div className="pipeline-candidate-card">
      <Link to={`/candidates/${entry.candidate_id}`} className="pipeline-candidate-info">
        <span className="pipeline-candidate-name">
          {entry.candidates.first_name} {entry.candidates.last_name}
        </span>
        {entry.candidates.current_title && (
          <span className="pipeline-candidate-title">{entry.candidates.current_title}</span>
        )}
        {entry.fit_score != null && (
          <span className="pipeline-candidate-fit">
            {Math.round(entry.fit_score)}<span className="fit-denom">/100</span>
          </span>
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
          >←</button>
        )}
        {onAdvance && (
          <button
            className="btn-advance-stage"
            onClick={e => { e.preventDefault(); onAdvance(entry) }}
            title="Advance to next stage"
          >→</button>
        )}
      </div>
    </div>
  )
}

function PipelineColumn({ stage, entries, stages, onAdvance, onGoBack, onDraftSubmission }) {
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
  const [deleting, setDeleting] = useState(false)

  // Interview questions
  const [interviewQuestions, setInterviewQuestions] = useState(null)
  const [interviewGenerating, setInterviewGenerating] = useState(false)
  const [interviewError, setInterviewError] = useState(null)

  // Boolean search strings
  const [searchStrings, setSearchStrings] = useState(null)
  const [searchGenerating, setSearchGenerating] = useState(false)
  const [searchError, setSearchError] = useState(null)

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
          .select('id, title, status, comp_min, comp_max, comp_type, comp_currency, process_steps, notes, search_strings, clients(name)')
          .eq('id', id)
          .eq('recruiter_id', recruiter.id)
          .single(),

        supabase
          .from('pipeline')
          .select('id, current_stage, fit_score, next_action_due_at, candidate_id, candidates(id, first_name, last_name, current_title)')
          .eq('role_id', id)
          .eq('status', 'active'),
      ])

      if (roleRes.error || !roleRes.data) {
        setNotFound(true)
      } else {
        setRole(roleRes.data)
        setPipeline(pipelineRes.data ?? [])
        if (roleRes.data.search_strings) {
          setSearchStrings(roleRes.data.search_strings)
        }
      }

      setLoading(false)
    }

    fetchRole()
  }, [id, recruiter?.id])

  async function handleDelete() {
    if (!window.confirm(`Delete "${role.title}"? This cannot be undone.`)) return
    setDeleting(true)
    await supabase.from('roles').delete().eq('id', id)
    navigate('/roles')
  }

  if (loading) {
    return <AppLayout><p className="muted">Loading…</p></AppLayout>
  }

  if (notFound) {
    return (
      <AppLayout>
        <p className="muted">Role not found.</p>
        <button className="btn-ghost" style={{ marginTop: 16 }} onClick={() => navigate('/roles')}>
          Go back
        </button>
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
    const currentIndex = stages.indexOf(entry.current_stage)
    const nextStage = stages[currentIndex + 1]
    if (!nextStage) return
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
  }

  async function handleGoBackStage(entry) {
    const currentIndex = stages.indexOf(entry.current_stage)
    const prevStage = stages[currentIndex - 1]
    if (!prevStage) return
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
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={`/roles/${id}/edit`} className="btn-ghost">Edit</Link>
          <button className="btn-ghost btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Pipeline board */}
      {stages.length === 0 ? (
        <p className="muted">No hiring stages defined for this role.</p>
      ) : (
        <div className="pipeline-board">
          {stages.map(stage => (
            <PipelineColumn
              key={stage}
              stage={stage}
              entries={byStage[stage] ?? []}
              stages={stages}
              onAdvance={handleAdvanceStage}
              onGoBack={handleGoBackStage}
              onDraftSubmission={handleDraftSubmission}
            />
          ))}
        </div>
      )}

      {/* Boolean Search Strings */}
      <section className="candidate-section" style={{ marginTop: 32 }}>
        <div className="section-heading-row">
          <h2 className="section-heading">Search Strings</h2>
          <button
            className="btn-ghost btn-sm"
            onClick={handleBuildSearchStrings}
            disabled={searchGenerating}
          >
            {searchGenerating ? 'Building…' : searchStrings ? 'Rebuild' : 'Build Search Strings'}
          </button>
        </div>

        {searchError && (
          <p className="error" style={{ marginTop: 8 }}>{searchError}</p>
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
          <button
            className="btn-ghost btn-sm"
            onClick={handleGenerateInterviewQuestions}
            disabled={interviewGenerating}
          >
            {interviewGenerating ? 'Generating…' : interviewQuestions ? 'Regenerate' : 'Generate'}
          </button>
        </div>

        {interviewError && (
          <p className="error" style={{ marginTop: 8 }}>{interviewError}</p>
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
          <h2 className="section-heading">Job Description</h2>
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
              <p className="muted modal-generating">Drafting submission…</p>
            )}

            {draftModal.phase === 'error' && (
              <p className="error" style={{ marginTop: 8 }}>{draftModal.error}</p>
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
