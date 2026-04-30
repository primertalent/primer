import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useRecruiter } from '../hooks/useRecruiter'
import AppLayout from '../components/AppLayout'
import { generateText } from '../lib/ai'
import { buildNextActionMessages } from '../lib/prompts/nextAction'
import { buildScreenerMessages } from '../lib/prompts/resumeScreener'
import { buildCareerTimelineMessages } from '../lib/prompts/careerTimeline'
import { buildSubmissionMessages } from '../lib/prompts/submissionDraft'
import { buildCandidatePitchMessages } from '../lib/prompts/candidatePitchBuilder'
import { buildScorecardMessages } from '../lib/prompts/candidateScorecard'
import { buildOutreachEmailMessages } from '../lib/prompts/candidateOutreachEmail'
import { buildLinkedInMessageMessages } from '../lib/prompts/linkedinMessageGenerator'
import { buildDebriefExtractorMessages } from '../lib/prompts/debriefExtractor'
import { buildInterviewQuestionMessages } from '../lib/prompts/interviewQuestionGenerator'
import { buildCallPrepMessages } from '../lib/prompts/callPrep'
import { buildConfidenceScoreMessages } from '../lib/prompts/confidenceScore'
import { urgencyClass } from '../lib/urgency'
import { useAgent } from '../context/AgentContext'

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

const PIPELINE_STAGES = ['sourced', 'screening', 'shortlisted', 'interviewing', 'offer', 'placed']

function PipelineEntry({ entry, onAdvance, advancing, onRemove }) {
  const roleName = entry.roles?.title ?? 'Unknown role'
  const clientName = entry.roles?.clients?.name ?? 'Unknown client'
  const currentStage = entry.current_stage?.toLowerCase()
  const currentIdx = PIPELINE_STAGES.indexOf(currentStage)
  const nextStage = currentIdx >= 0 && currentIdx < PIPELINE_STAGES.length - 1
    ? PIPELINE_STAGES[currentIdx + 1]
    : null

  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState(null)

  async function handleConfirmRemove() {
    setRemoving(true)
    setRemoveError(null)
    const err = await onRemove(entry.id)
    if (err) {
      setRemoveError('Couldn\'t remove. Try again.')
      setRemoving(false)
      setConfirmRemove(false)
    }
  }

  // Next action editing
  const [nextEditing, setNextEditing] = useState(false)
  const [nextText, setNextText]       = useState(entry.next_action ?? '')
  const [nextDue, setNextDue]         = useState(entry.next_action_due_at ? entry.next_action_due_at.slice(0, 10) : '')
  const [nextSaving, setNextSaving]   = useState(false)
  const [nextError, setNextError]     = useState(null)
  const [displayNext, setDisplayNext] = useState(entry.next_action ?? null)
  const [displayDue, setDisplayDue]   = useState(entry.next_action_due_at ?? null)

  async function handleSaveNextAction() {
    setNextSaving(true)
    setNextError(null)
    const text = nextText.trim() || null
    const due  = nextDue ? new Date(nextDue).toISOString() : null
    const { error } = await supabase
      .from('pipeline')
      .update({ next_action: text, next_action_due_at: due })
      .eq('id', entry.id)
    if (error) {
      setNextError('Couldn\'t save. Try again.')
    } else {
      setDisplayNext(text)
      setDisplayDue(due)
      setNextEditing(false)
    }
    setNextSaving(false)
  }

  // Recruiter judgment
  const [recruiterEditing, setRecruiterEditing] = useState(false)
  const [recruiterScore, setRecruiterScore] = useState(entry.recruiter_score ?? '')
  const [recruiterNote, setRecruiterNote] = useState(entry.recruiter_note ?? '')
  const [recruiterSaving, setRecruiterSaving] = useState(false)
  const [recruiterError, setRecruiterError] = useState(null)
  const [displayScore, setDisplayScore] = useState(entry.recruiter_score ?? null)
  const [displayNote, setDisplayNote] = useState(entry.recruiter_note ?? null)

  async function handleSaveRecruiter() {
    setRecruiterSaving(true)
    setRecruiterError(null)
    const score = recruiterScore !== '' ? Math.min(10, Math.max(1, parseInt(recruiterScore, 10))) : null
    const note = recruiterNote.trim() || null
    const { error } = await supabase
      .from('pipeline')
      .update({ recruiter_score: score, recruiter_note: note })
      .eq('id', entry.id)
    if (error) {
      setRecruiterError('Couldn\'t save. Try again.')
    } else {
      setDisplayScore(score)
      setDisplayNote(note)
      setRecruiterEditing(false)
    }
    setRecruiterSaving(false)
  }

  return (
    <div className="pipeline-entry">
      <div className="pipeline-role">
        <span className="pipeline-role-title">{roleName}</span>
        <span className="pipeline-client">{clientName}</span>
        <button className="btn-row-remove" onClick={() => setConfirmRemove(true)} title="Remove from pipeline">×</button>
      </div>
      <div className="pipeline-meta">
        <span className="stage-badge">{entry.current_stage}</span>
        {entry.fit_score != null && (
          <span className="fit-score">{Math.round(entry.fit_score)}<span className="fit-denom">/100</span></span>
        )}
        {displayScore != null && (
          <span className="recruiter-score-badge" title="Your score">{displayScore}/10 you</span>
        )}
        <button
          className="btn-ghost btn-sm pipeline-advance-btn"
          onClick={() => onAdvance(entry)}
          disabled={!nextStage || advancing}
          title={nextStage ? `Advance to ${nextStage}` : 'Already placed'}
        >
          {advancing ? '…' : nextStage ? `→ ${nextStage}` : 'Placed'}
        </button>
      </div>
      {!nextEditing ? (
        <div className="pipeline-next-action">
          {displayNext ? (
            <>
              <span className="detail-label">Next action</span>
              <span className="detail-value">{displayNext}</span>
              {displayDue && (
                <span className="due-date">
                  {urgencyClass(displayDue) && (
                    <span className={`urgency-dot ${urgencyClass(displayDue)}`} />
                  )}
                  Due {formatDateShort(displayDue)}
                </span>
              )}
            </>
          ) : null}
          <button
            className="btn-ghost btn-sm"
            style={{ marginLeft: 'auto', flexShrink: 0 }}
            onClick={() => setNextEditing(true)}
          >
            {displayNext ? 'Edit action' : 'Set next action'}
          </button>
        </div>
      ) : (
        <div className="next-action-edit">
          <input
            className="next-action-input"
            type="text"
            placeholder="What needs to happen next?"
            value={nextText}
            onChange={e => setNextText(e.target.value)}
          />
          <input
            className="next-action-date"
            type="date"
            value={nextDue}
            onChange={e => setNextDue(e.target.value)}
          />
          <div className="recruiter-edit-actions">
            <button className="btn-primary btn-sm" onClick={handleSaveNextAction} disabled={nextSaving}>
              {nextSaving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn-ghost btn-sm" onClick={() => {
              setNextText(displayNext ?? '')
              setNextDue(displayDue ? displayDue.slice(0, 10) : '')
              setNextEditing(false)
              setNextError(null)
            }}>Cancel</button>
          </div>
          {nextError && <p className="inline-error">{nextError}</p>}
        </div>
      )}

      {/* Recruiter judgment */}
      <div className="recruiter-judgment">
        {!recruiterEditing ? (
          <>
            {(displayScore != null || displayNote) && (
              <div className="recruiter-judgment-display">
                {displayScore != null && (
                  <span className="recruiter-score-badge">{displayScore}/10</span>
                )}
                {displayNote && (
                  <p className="recruiter-note">{displayNote}</p>
                )}
              </div>
            )}
            <button className="btn-ghost btn-sm" onClick={() => setRecruiterEditing(true)}>
              {displayScore != null || displayNote ? 'Edit your take' : 'Add your take'}
            </button>
          </>
        ) : (
          <div className="recruiter-edit-form">
            <div className="recruiter-edit-row">
              <span className="recruiter-edit-label">Your score</span>
              <input
                type="number"
                min="1"
                max="10"
                className="recruiter-score-input"
                placeholder="1–10"
                value={recruiterScore}
                onChange={e => setRecruiterScore(e.target.value)}
              />
            </div>
            <textarea
              className="recruiter-note-input"
              placeholder="What do you know that the screener doesn't?"
              rows={2}
              value={recruiterNote}
              onChange={e => setRecruiterNote(e.target.value)}
            />
            {recruiterError && <p className="inline-error">{recruiterError}</p>}
            <div className="recruiter-edit-actions">
              <button className="btn-primary btn-sm" onClick={handleSaveRecruiter} disabled={recruiterSaving}>
                {recruiterSaving ? 'Saving…' : 'Save'}
              </button>
              <button className="btn-ghost btn-sm" onClick={() => {
                setRecruiterScore(displayScore ?? '')
                setRecruiterNote(displayNote ?? '')
                setRecruiterEditing(false)
                setRecruiterError(null)
              }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {confirmRemove && (
        <div className="inline-confirm">
          <span>Remove from {roleName}?</span>
          <button className="btn-confirm-yes" onClick={handleConfirmRemove} disabled={removing}>
            {removing ? 'Removing…' : 'Yes, remove'}
          </button>
          <button className="btn-confirm-cancel" onClick={() => setConfirmRemove(false)}>Cancel</button>
        </div>
      )}
      {removeError && <p className="inline-error">{removeError}</p>}
    </div>
  )
}

function InteractionEntry({ interaction, onDelete, hasDebrief, onDebrief, onEdit }) {
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    const err = await onDelete(interaction.id)
    if (err) {
      setDeleteError('Couldn\'t delete. Try again.')
      setDeleting(false)
      setConfirm(false)
    }
  }

  return (
    <div
      className="interaction-entry interaction-entry--clickable"
      onClick={() => onEdit && onEdit(interaction)}
    >
      <div className="interaction-meta">
        <span className="interaction-type">{TYPE_LABELS[interaction.type] ?? interaction.type}</span>
        {interaction.direction && (
          <span className="interaction-direction">{interaction.direction}</span>
        )}
        <span className="interaction-date">{formatDateShort(interaction.occurred_at)}</span>
        <button className="btn-row-remove" onClick={e => { e.stopPropagation(); setConfirm(true) }} title="Delete">×</button>
      </div>
      {interaction.subject && (
        <p className="interaction-subject">{interaction.subject}</p>
      )}
      {interaction.body && (
        <p className="interaction-body">{interaction.body}</p>
      )}
      {onDebrief && !hasDebrief && (
        <button
          className="btn-ghost btn-sm debrief-btn"
          onClick={e => { e.stopPropagation(); onDebrief(interaction.id) }}
        >
          + Debrief
        </button>
      )}
      {hasDebrief && (
        <span className="debrief-logged-badge">Debriefed</span>
      )}
      {confirm && (
        <div className="inline-confirm" onClick={e => e.stopPropagation()}>
          <span>Delete this interaction?</span>
          <button className="btn-confirm-yes" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Yes, delete'}
          </button>
          <button className="btn-confirm-cancel" onClick={() => setConfirm(false)}>Cancel</button>
        </div>
      )}
      {deleteError && <p className="inline-error">{deleteError}</p>}
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

// ── Screener history row ──────────────────────────────

function ScoreHistoryRow({ sr, inPipeline, onDelete }) {
  const score = (sr.result?.match_score ?? 0) * 10
  const tenth = score / 10
  const display = Number.isInteger(tenth) ? tenth : tenth.toFixed(1)
  let variant = 'none'
  if (score >= 80) variant = 'green'
  else if (score >= 50) variant = 'amber'
  else variant = 'red'

  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const [noteEditing, setNoteEditing] = useState(false)
  const [noteDraft, setNoteDraft] = useState(sr.recruiter_note ?? '')
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteError, setNoteError] = useState(null)
  const [displayNote, setDisplayNote] = useState(sr.recruiter_note ?? null)

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    const err = await onDelete(sr.id)
    if (err) {
      setDeleteError('Couldn\'t delete. Try again.')
      setDeleting(false)
      setConfirm(false)
    }
  }

  async function handleSaveNote() {
    setNoteSaving(true)
    setNoteError(null)
    const note = noteDraft.trim() || null
    const { error } = await supabase
      .from('screener_results')
      .update({ recruiter_note: note })
      .eq('id', sr.id)
    if (error) {
      setNoteError('Couldn\'t save. Try again.')
    } else {
      setDisplayNote(note)
      setNoteEditing(false)
    }
    setNoteSaving(false)
  }

  return (
    <div className="scores-history-row">
      <div className="scores-history-role">
        <span className="scores-history-title">{sr.roles?.title ?? 'Unknown role'}</span>
        {sr.roles?.clients?.name && (
          <span className="scores-history-client">{sr.roles.clients.name}</span>
        )}
        {!inPipeline && (
          <span className="scores-history-badge scores-history-badge--pre-pipeline">Pre-pipeline</span>
        )}
      </div>
      <div className="scores-history-right">
        <span className={`fit-badge fit-badge--${variant}`}>
          {display}<span className="fit-badge-denom">/10</span>
        </span>
        <span className="scores-history-date">{formatDateShort(sr.scored_at)}</span>
        {sr.result?.recommendation_reason && (
          <p className="scores-history-rationale">{sr.result.recommendation_reason}</p>
        )}
        <button className="btn-row-remove" onClick={() => setConfirm(true)} title="Delete result">×</button>
      </div>

      {/* Recruiter note on this screening run */}
      <div className="recruiter-note-row">
        {!noteEditing ? (
          <>
            {displayNote && <p className="recruiter-note" style={{ marginBottom: 4 }}>{displayNote}</p>}
            <button className="btn-ghost btn-sm" onClick={() => setNoteEditing(true)}>
              {displayNote ? 'Edit note' : 'Add note'}
            </button>
          </>
        ) : (
          <div className="recruiter-edit-form">
            <textarea
              className="recruiter-note-input"
              placeholder="Your read on this screening…"
              rows={2}
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
            />
            {noteError && <p className="inline-error">{noteError}</p>}
            <div className="recruiter-edit-actions">
              <button className="btn-primary btn-sm" onClick={handleSaveNote} disabled={noteSaving}>
                {noteSaving ? 'Saving…' : 'Save'}
              </button>
              <button className="btn-ghost btn-sm" onClick={() => {
                setNoteDraft(displayNote ?? '')
                setNoteEditing(false)
                setNoteError(null)
              }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {confirm && (
        <div className="inline-confirm">
          <span>Delete this result?</span>
          <button className="btn-confirm-yes" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Yes, delete'}
          </button>
          <button className="btn-confirm-cancel" onClick={() => setConfirm(false)}>Cancel</button>
        </div>
      )}
      {deleteError && <p className="inline-error">{deleteError}</p>}
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

// ── Scorecard result ──────────────────────────────────────

const REC_SCORECARD_STYLES = {
  advance: { label: 'Advance',  cls: 'screener-rec--advance' },
  hold:    { label: 'Hold',     cls: 'screener-rec--hold'    },
  probe:   { label: 'Probe',    cls: 'screener-rec--hold'    },
  pass:    { label: 'Pass',     cls: 'screener-rec--pass'    },
}

const DIMENSION_LABELS = {
  experience_fit:    'Experience Fit',
  skills_match:      'Skills Match',
  career_trajectory: 'Career Trajectory',
  culture_signals:   'Culture Signals',
  red_flags:         'Red Flags',
}

function ScoreDots({ score, max = 5, inverted = false }) {
  return (
    <span className="score-dots">
      {Array.from({ length: max }, (_, i) => {
        const filled = inverted ? i >= max - score : i < score
        return <span key={i} className={`score-dot${filled ? ' score-dot--filled' : ''}`} />
      })}
    </span>
  )
}

function ScorecardResult({ result }) {
  const rec = REC_SCORECARD_STYLES[result.recommendation] ?? { label: result.recommendation, cls: '' }
  return (
    <div className="scorecard-result">
      <div className="scorecard-header">
        <div className="scorecard-overall">
          <span className="scorecard-score-value">{result.overall_score}</span>
          <span className="screener-score-denom">/10</span>
        </div>
        <div className="scorecard-header-right">
          <span className={`screener-rec-badge ${rec.cls}`}>{rec.label}</span>
          {result.verdict && <p className="screener-rec-reason">{result.verdict}</p>}
        </div>
      </div>
      <div className="scorecard-dimensions">
        {Object.entries(result.dimensions ?? {}).map(([key, dim]) => (
          <div key={key} className="scorecard-dimension-row">
            <div className="scorecard-dim-left">
              <span className="scorecard-dim-label">{DIMENSION_LABELS[key] ?? key}</span>
              <span className="scorecard-dim-rationale">{dim.rationale}</span>
            </div>
            <div className="scorecard-dim-right">
              <ScoreDots score={dim.score} inverted={key === 'red_flags'} />
              <span className="scorecard-dim-score">{dim.score}/5</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Expected comp soft prompt ─────────────────────────────

function CompPrompt({ entry, onSave }) {
  const [comp, setComp] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const val = parseInt(comp, 10)
    if (!val || val <= 0) return
    setSaving(true)
    await onSave(val)
    setSaving(false)
  }

  const roleName = entry.roles?.title ?? 'this role'

  return (
    <div className="comp-prompt">
      <p className="comp-prompt-label">Expected comp for {roleName}?</p>
      <p className="comp-prompt-hint">Wren uses this to track your pipeline value.</p>
      <div className="comp-prompt-row">
        <span className="comp-prefix">$</span>
        <input
          type="number"
          className="field-input comp-prompt-input"
          placeholder="Annual base"
          value={comp}
          onChange={e => setComp(e.target.value)}
          min="0"
        />
        <button className="btn-primary btn-sm" onClick={handleSave} disabled={saving || !comp}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ── Debrief signal panel ──────────────────────────────────

const DEBRIEF_SIGNAL_CATS = [
  { key: 'motivation_signals',     label: 'Motivation',   cls: 'dsig--motivation' },
  { key: 'competitive_signals',    label: 'Competitive',  cls: 'dsig--competitive' },
  { key: 'risk_flags',             label: 'Risk',         cls: 'dsig--risk' },
  { key: 'positive_signals',       label: 'Positive',     cls: 'dsig--positive' },
  { key: 'hiring_manager_signals', label: 'HM Signals',   cls: 'dsig--hm' },
]

function DebriefSignalPanel({ debriefs, onOpenDebrief }) {
  const latest = debriefs[0]
  if (!latest) return null

  const outcomeClass = {
    advance: 'debrief-outcome--advance',
    reject:  'debrief-outcome--reject',
    hold:    'debrief-outcome--hold',
    neutral: 'debrief-outcome--neutral',
  }[latest.outcome] ?? ''

  return (
    <div className="debrief-signal-panel">
      <div className="debrief-signal-header">
        <span className={`debrief-outcome-badge ${outcomeClass}`}>{latest.outcome}</span>
        <span className="debrief-signal-date">{formatDateShort(latest.captured_at)}</span>
        <button className="btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={onOpenDebrief}>
          + New debrief
        </button>
      </div>
      {DEBRIEF_SIGNAL_CATS.map(cat => {
        const items = latest[cat.key]
        if (!items?.length) return null
        return (
          <div key={cat.key} className="debrief-signal-cat">
            <span className={`debrief-signal-cat-label ${cat.cls}`}>{cat.label}</span>
            <ul className="debrief-signal-list">
              {items.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )
      })}
      {latest.questions_to_ask_next?.length > 0 && (
        <div className="debrief-signal-cat">
          <span className="debrief-signal-cat-label dsig--questions">Ask next</span>
          <ul className="debrief-signal-list">
            {latest.questions_to_ask_next.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </div>
      )}
      {latest.updates_to_record?.length > 0 && (
        <div className="debrief-signal-cat">
          <span className="debrief-signal-cat-label dsig--updates">Update record</span>
          <ul className="debrief-signal-list debrief-signal-list--updates">
            {latest.updates_to_record.map((u, i) => <li key={i}>{u}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── New helpers ───────────────────────────────────────────

function daysSince(isoDate) {
  if (!isoDate) return null
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000)
}

function computeRiskPills(debriefs, candidate) {
  const pills = []
  const allRisk       = debriefs.flatMap(d => d.risk_flags ?? []).join(' ').toLowerCase()
  const allMotivation = debriefs.flatMap(d => d.motivation_signals ?? []).join(' ').toLowerCase()
  const allCompetitive= debriefs.flatMap(d => d.competitive_signals ?? []).join(' ').toLowerCase()
  const allHM         = debriefs.flatMap(d => d.hiring_manager_signals ?? []).join(' ').toLowerCase()
  const allText       = [allRisk, allMotivation, allCompetitive, allHM].join(' ')

  if (/comp.gap|salary.gap|underpaid|below.market|comp.concern|comp.mismatch/.test(allText)) {
    pills.push({ label: 'Comp gap', variant: 'amber' })
  }

  const highTenure = (candidate?.career_signals ?? []).includes('Long Tenure')
  const counterSignals = /counter.offer|counter-offer|underpaid|below.market|passive.search|not actively/.test(allText)
  if (counterSignals || (highTenure && /passive|not looking|not actively/.test(allText))) {
    pills.push({ label: 'Counter offer risk', variant: 'red' })
  }

  if (/thin motivation|low motivation|unclear motivation|not motivated|unmotivated/.test(allMotivation + ' ' + allRisk)) {
    pills.push({ label: 'Thin motivation', variant: 'amber' })
  }

  if (/slow|no feedback|delayed|not responsive|feedback.late/.test(allHM + ' ' + allRisk)) {
    pills.push({ label: 'Slow HM', variant: 'amber' })
  }

  if (/stall|no progress|stuck/.test(allRisk)) {
    pills.push({ label: 'Stalled', variant: 'gray' })
  }

  return pills
}

function computeZoneAActions({ pipelines, interactions, debriefs }) {
  const actions = []
  const primary = pipelines[0]

  if (!primary) {
    actions.push({ id: 'add_to_role', label: 'Add to a role' })
    return actions
  }

  const stage = primary.current_stage?.toLowerCase() ?? ''
  const latest = interactions[0]
  const latestHasDebrief = latest
    ? debriefs.some(d => d.interaction_id === latest.id)
    : false
  const daysSinceContact = latest ? daysSince(latest.occurred_at) : null

  if (latest && !latestHasDebrief && (latest.type === 'call' || latest.type === 'meeting')) {
    actions.push({ id: 'log_debrief', label: 'Log debrief' })
  }

  if (!latest || daysSinceContact === null || daysSinceContact > 7) {
    actions.push({ id: 'log_interaction', label: 'Log interaction' })
  }

  if (stage === 'screening') {
    actions.push({ id: 'screen_role', label: 'Screen against role' })
  }

  if (['shortlisted', 'interviewing'].includes(stage)) {
    actions.push({ id: 'prep_interview', label: 'Prep for next interview' })
  }

  if (stage === 'offer') {
    actions.push({ id: 'lock_comp', label: 'Lock comp expectations' })
    actions.push({ id: 'prep_counter', label: 'Prep for counter offer' })
  }

  return actions.slice(0, 3)
}

// ── Deal Status Bar ───────────────────────────────────────

function DealStatusBar({ candidate, pipelines, debriefs, interactions, onOpenComp, onOpenPicker, onSetCompInline }) {
  const fullName = `${candidate.first_name} ${candidate.last_name}`
  const primary = pipelines[0] ?? null
  const riskPills = computeRiskPills(debriefs, candidate)

  const aiScore = primary?.fit_score != null ? Math.round(primary.fit_score) : null
  const recruiterScore = primary?.recruiter_score ?? null
  const aiScoreClass = aiScore == null ? '' : aiScore >= 70 ? 'cc-sticky-score--green' : aiScore >= 40 ? 'cc-sticky-score--amber' : 'cc-sticky-score--red'
  const confAI = primary?.ai_confidence_post ?? null
  const confRecruiter = primary?.recruiter_confidence_post ?? null

  const daysInStage = primary?.updated_at ? daysSince(primary.updated_at) : null
  const stageParts = [
    primary?.current_stage,
    daysInStage != null ? `${daysInStage}d` : null,
  ].filter(Boolean)

  const hasPipeline = pipelines.length > 0
  const lastTouch = interactions[0]?.occurred_at
  const lastTouchDays = lastTouch ? daysSince(lastTouch) : null

  return (
    <div className="deal-status-bar">
      {/* Row 1: identity + role + stage + scores + risk pills */}
      <div className="dsb-row dsb-row--main">
        <div className="dsb-identity">
          <span className="dsb-name">{fullName}</span>
          {(candidate.current_title || candidate.current_company) && (
            <span className="dsb-subtitle">
              {[candidate.current_title, candidate.current_company].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>

        {hasPipeline && primary?.roles && (
          <Link className="dsb-role-link" to={`/roles/${primary.role_id}`}>
            {primary.roles.title}{primary.roles.clients?.name ? ` · ${primary.roles.clients.name}` : ''}
          </Link>
        )}

        {hasPipeline && primary?.current_stage && (
          <span className="dsb-stage-badge">{stageParts.join(' · ')}</span>
        )}

        {hasPipeline && (aiScore != null || recruiterScore != null) && (
          <div className="cc-sticky-scores">
            {aiScore != null && (
              <span className={`cc-sticky-score ${aiScoreClass}`}>AI {aiScore}</span>
            )}
            {recruiterScore != null && (
              <span className="cc-sticky-score cc-sticky-score--recruiter">You {recruiterScore}</span>
            )}
            {(confAI != null || confRecruiter != null) && (
              <>
                <span className="cc-sticky-score-divider">·</span>
                {confAI != null && <span className="cc-sticky-score cc-sticky-score--conf">W{confAI}</span>}
                {confRecruiter != null && <span className="cc-sticky-score cc-sticky-score--conf-recruiter">Y{confRecruiter}</span>}
              </>
            )}
          </div>
        )}

        {riskPills.length > 0 && (
          <div className="risk-pills">
            {riskPills.map(p => (
              <span key={p.label} className={`risk-pill risk-pill--${p.variant}`}>{p.label}</span>
            ))}
          </div>
        )}

        {!hasPipeline && (
          <>
            {lastTouchDays != null && (
              <span className="dsb-last-touch">Last touch: {lastTouchDays}d ago</span>
            )}
            <button className="btn-primary btn-sm" onClick={onOpenPicker}>Add to a role</button>
          </>
        )}
      </div>

      {/* Row 2: next action + comp */}
      {hasPipeline && (
        <div className="dsb-row dsb-row--sub">
          {primary?.next_action ? (
            <span className="dsb-next-action">{primary.next_action}</span>
          ) : (
            <span className="dsb-next-action dsb-next-action--empty">No next action</span>
          )}
          <div className="dsb-comp">
            {primary?.expected_comp != null ? (
              <span className="dsb-comp-value">${primary.expected_comp.toLocaleString()}</span>
            ) : (
              <button className="dsb-set-comp-chip" onClick={() => onOpenComp(primary)}>
                Set comp
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Latest debrief summary card ───────────────────────────

function LatestDebriefSummaryCard({ debrief, onExpand, onNewDebrief }) {
  const [expanded, setExpanded] = useState(false)

  const outcomeClass = {
    advance: 'debrief-outcome--advance',
    reject:  'debrief-outcome--reject',
    hold:    'debrief-outcome--hold',
    neutral: 'debrief-outcome--neutral',
  }[debrief.outcome] ?? ''

  return (
    <div className="debrief-summary-card">
      <div className="dsc-header">
        <span className={`debrief-outcome-badge ${outcomeClass}`}>{debrief.outcome}</span>
        <span className="dsc-date">{formatDateShort(debrief.captured_at)}</span>
        <button className="btn-ghost btn-sm dsc-expand-btn" onClick={() => setExpanded(v => !v)}>
          {expanded ? 'Collapse' : 'Expand'}
        </button>
        <button className="btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={onNewDebrief}>
          + New debrief
        </button>
      </div>
      {debrief.summary && (
        <p className="dsc-summary">{debrief.summary}</p>
      )}
      {expanded && onExpand && (
        <button className="btn-ghost btn-sm dsc-full-link" onClick={onExpand}>
          View full signal breakdown ↓
        </button>
      )}
    </div>
  )
}

// ── Collapsible section ───────────────────────────────────

function CollapsibleSection({ title, collapsed, onToggle, badge, children }) {
  return (
    <section className="candidate-section collapsible-section">
      <button className="collapsible-header" onClick={onToggle}>
        <span className="section-heading collapsible-title">{title}</span>
        {badge && <span className="collapsible-badge">{badge}</span>}
        <span className="collapsible-chevron">{collapsed ? '›' : '‹'}</span>
      </button>
      {!collapsed && (
        <div className="collapsible-content">{children}</div>
      )}
    </section>
  )
}

// ── Interaction edit modal ────────────────────────────────

function InteractionEditModal({ modal, onSave, onClose }) {
  const [type, setType]   = useState(modal.interaction?.type ?? 'call')
  const [notes, setNotes] = useState(modal.interaction?.body ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  const hasDebrief = modal.linkedDebriefId != null

  async function handleSave() {
    if (!notes.trim()) { setError('Notes are required.'); return }
    setSaving(true)
    setError(null)
    await onSave(modal.interaction.id, { type, body: notes.trim() })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Edit Interaction</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="log-form-row" style={{ marginBottom: 12 }}>
          <select className="log-select" value={type} onChange={e => setType(e.target.value)}>
            <option value="call">Call</option>
            <option value="email">Email</option>
            <option value="note">Note</option>
            <option value="meeting">Meeting</option>
            <option value="linkedin">LinkedIn</option>
            <option value="text">Text</option>
          </select>
        </div>
        <textarea
          className="log-textarea"
          placeholder="Notes…"
          rows={4}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          autoFocus
        />
        {hasDebrief && (
          <p className="debrief-linked-note">Debrief linked to this interaction — link preserved on save.</p>
        )}
        {error && <p className="error" style={{ marginTop: 4 }}>{error}</p>}
        <div className="modal-actions">
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Zone C popover ────────────────────────────────────────

function ZoneCMenu({ candidate, pipelines, onEdit, onCallMode, onRemoveFromPipeline, onMarkPlaced, onDeleteCandidate, onClose }) {
  const navigate = useNavigate()
  const menuRef  = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const hasPipeline = pipelines.length > 0
  const stage = pipelines[0]?.current_stage?.toLowerCase()

  return (
    <div className="zone-c-popover" ref={menuRef}>
      <button className="zone-c-item" onClick={() => { onCallMode(); onClose() }}>Call Mode</button>
      <button className="zone-c-item" onClick={() => { onEdit(); onClose() }}>Edit candidate</button>
      {hasPipeline && (
        <button className="zone-c-item" onClick={() => { onRemoveFromPipeline(); onClose() }}>
          Remove from pipeline
        </button>
      )}
      {hasPipeline && stage !== 'placed' && (
        <button className="zone-c-item" onClick={() => { onMarkPlaced(); onClose() }}>
          Mark as placed
        </button>
      )}
      <button className="zone-c-item zone-c-item--danger" onClick={() => { onDeleteCandidate(); onClose() }}>
        Delete candidate
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────

export default function CandidateCard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { recruiter } = useRecruiter()
  const { fireResponse, registerAction, unregisterAction } = useAgent()

  const [candidate, setCandidate] = useState(null)
  const [pipelines, setPipelines] = useState([])
  const [interactions, setInteractions] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [suggestion, setSuggestion]         = useState(null)
  const [generating, setGenerating]         = useState(false)
  const [genError, setGenError]             = useState(null)
  const [savedNextAction, setSavedNextAction] = useState(null) // from enrichment_data
  const [nextActionEditing, setNextActionEditing] = useState(false)
  const [nextActionDraft, setNextActionDraft]     = useState('')
  const [nextActionSaving, setNextActionSaving]   = useState(false)

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
  const [screenerHistory, setScreenerHistory] = useState([])

  // Scorecard
  const [scorecard, setScorecard] = useState(null)
  const [scorecardGenerating, setScorecardGenerating] = useState(false)
  const [scorecardError, setScorecardError] = useState(null)

  // Candidate pitch
  const [pitchText, setPitchText] = useState(null)
  const [pitchGenerating, setPitchGenerating] = useState(false)
  const [pitchError, setPitchError] = useState(null)
  const [pitchSaving, setPitchSaving] = useState(false)
  const [pitchSaved, setPitchSaved] = useState(false)

  // Outreach email modal
  const [outreachModal, setOutreachModal] = useState({
    open: false,
    phase: 'pick',  // 'pick' | 'generating' | 'done' | 'error'
    roleId: '',
    result: null,   // { subject, body }
    error: null,
  })

  // LinkedIn message modal
  const [linkedinModal, setLinkedinModal] = useState({
    open: false,
    phase: 'pick',  // 'pick' | 'generating' | 'done' | 'error'
    roleId: '',
    text: null,
    error: null,
  })

  // Interaction log form
  const [logOpen, setLogOpen] = useState(false)
  const [logForm, setLogForm] = useState({ type: 'call', direction: 'outbound', occurred_at: '', body: '', confidence: '' })
  const [logSaving, setLogSaving] = useState(false)
  const [logError, setLogError] = useState(null)

  // Debriefs
  const [debriefs, setDebriefs] = useState([])
  const [debriefModal, setDebriefModal] = useState({
    open: false,
    phase: 'input',  // 'input' | 'extracting' | 'review' | 'saving' | 'error'
    interactionId: null,
    pipelineId: '',
    raw: '',
    outcome: 'neutral',
    extracted: null,
    reviewSummary: '',
    reviewNextAction: '',
    confidence_post: '',
    error: null,
  })

  // Expected comp modal (blocking on stage advance to interview+)
  const [compModal, setCompModal] = useState({ open: false, entry: null, nextStage: '', comp: '', saving: false })

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]           = useState(false)
  const [deleteError, setDeleteError]     = useState(null)

  // Career timeline
  const [timeline, setTimeline] = useState(null)
  const [signals, setSignals] = useState(null)
  const [parsingCareer, setParsingCareer] = useState(false)
  const [careerError, setCareerError] = useState(null)
  const [clearCareerConfirm, setClearCareerConfirm] = useState(false)
  const [clearingCareer, setClearingCareer] = useState(false)

  // New layout state
  const autoParseFiredRef = useRef(false)
  const [showAllInteractions, setShowAllInteractions] = useState(false)
  const [collapseResume, setCollapseResume] = useState(true)
  const [collapseAllDebriefs, setCollapseAllDebriefs] = useState(true)
  const [collapseSignals, setCollapseSignals] = useState(true)
  const [collapsePipeline, setCollapsePipeline] = useState(true)
  const [collapseScoreHistory, setCollapseScoreHistory] = useState(true)
  const [stageHistory, setStageHistory] = useState(null)
  const [stageHistoryLoading, setStageHistoryLoading] = useState(false)
  const [zoneCOpen, setZoneCOpen] = useState(false)
  const [zoneAStub, setZoneAStub] = useState(null)
  const [callPrepResult, setCallPrepResult] = useState({ type: null, loading: false, result: null, error: null })
  const [screeningInline, setScreeningInline] = useState(false) // Zone A screen trigger

  // Interaction edit modal
  const [editInteractionModal, setEditInteractionModal] = useState({ open: false, interaction: null, linkedDebriefId: null })

  // Zone B inline results
  const [zoneBPitch, setZoneBPitch] = useState({ generating: false, result: null, error: null })
  const [zoneBIQ, setZoneBIQ] = useState({ generating: false, result: null, error: null })

  // Submission draft modal
  const [subModal, setSubModal] = useState({
    open: false,
    phase: 'pick',    // 'pick' | 'generating' | 'done' | 'error'
    format: 'email',  // 'email' | 'bullet'
    mode: null,       // 'jd' | 'generic'
    roleId: '',
    text: '',
    error: null,
  })
  const [subSaving, setSubSaving] = useState(false)
  const [subSaved, setSubSaved] = useState(false)
  const subTextareaRef = useRef(null)

  useEffect(() => {
    if (!id || !recruiter?.id) return

    async function fetchAll() {
      const settled = await Promise.allSettled([
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
          .order('occurred_at', { ascending: false }),

        supabase
          .from('roles')
          .select('id, title, notes, process_steps, clients(name)')
          .eq('recruiter_id', recruiter.id)
          .eq('status', 'open')
          .order('created_at', { ascending: false }),

        supabase
          .from('screener_results')
          .select('*, roles(title, clients(name))')
          .eq('candidate_id', id)
          .order('scored_at', { ascending: false }),

        supabase
          .from('debriefs')
          .select('*')
          .eq('candidate_id', id)
          .order('captured_at', { ascending: false }),
      ])
      const [candidateRes, pipelineRes, interactionRes, rolesRes, screenerHistoryRes, debriefsRes] = settled.map(r =>
        r.status === 'fulfilled' ? r.value : { data: null, error: { message: 'Request failed' } }
      )

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
        setSavedNextAction(c.enrichment_data?.next_action ?? null)
        setPipelines(pipelineRes.data ?? [])
        setInteractions(interactionRes.data ?? [])
        setOpenRoles(rolesRes.data ?? [])
        setScreenerHistory(screenerHistoryRes.data ?? [])
        setDebriefs(debriefsRes.data ?? [])

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

  // Register page-level action handlers so suggestion chips work while on this page
  useEffect(() => {
    registerAction('log_debrief',     ()    => handleOpenDebrief(null))
    registerAction('log_interaction', ()    => handleLogOpen())
    registerAction('set_expected_comp', (ctx) => {
      const entry = pipelines.find(p => p.id === ctx?.pipeline_id) ?? pipelines[0]
      if (entry) setCompModal({ open: true, entry, nextStage: entry.current_stage, comp: '', saving: false })
    })
    registerAction('prep_call', (ctx) => handleCallPrep(ctx?.prep_type ?? 'prep_interview'))
    return () => {
      unregisterAction('log_debrief')
      unregisterAction('log_interaction')
      unregisterAction('set_expected_comp')
      unregisterAction('prep_call')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelines])

  // Auto-parse career timeline on load if cv_text exists but no timeline yet
  useEffect(() => {
    if (!candidate) return
    if (autoParseFiredRef.current) return
    if ((candidate.career_timeline?.length ?? 0) > 0) return
    if (!candidate.cv_text) return
    autoParseFiredRef.current = true
    handleParseCareer()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate?.id])

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

      // Always persist to screener_results — no pipeline entry required
      const { data: savedResult, error: srErr } = await supabase
        .from('screener_results')
        .insert({
          recruiter_id: recruiter.id,
          candidate_id: id,
          role_id:      screenerRoleId,
          result,
        })
        .select()
        .single()
      if (srErr) console.error('screener_results save failed:', srErr)
      else setScreenerHistory(prev => [savedResult, ...prev])

      // Backfill pipeline entry if candidate is already in this role's pipeline
      const { data: freshEntry } = await supabase
        .from('pipeline')
        .select('id')
        .eq('candidate_id', id)
        .eq('role_id', screenerRoleId)
        .maybeSingle()

      if (freshEntry && result.match_score != null) {
        const fitScore = result.match_score * 10
        const rationale = result.recommendation_reason ?? null
        const { error: scoreErr } = await supabase
          .from('pipeline')
          .update({ fit_score: fitScore, fit_score_rationale: rationale, screener_result: result })
          .eq('id', freshEntry.id)
        if (scoreErr) console.error('pipeline score backfill failed:', scoreErr)
        setPipelines(prev => prev.map(p =>
          p.id === freshEntry.id
            ? { ...p, fit_score: fitScore, fit_score_rationale: rationale, screener_result: result }
            : p
        ))
      }
    } catch (err) {
      setScreenError(err.message ?? 'Screening failed.')
    } finally {
      setScreening(false)
    }
  }

  const [advancingId, setAdvancingId] = useState(null)

  const COMP_REQUIRED_STAGES = new Set(['interviewing', 'offer', 'placed'])

  async function handleAdvanceStage(entry) {
    const currentIdx = PIPELINE_STAGES.indexOf(entry.current_stage?.toLowerCase())
    if (currentIdx < 0 || currentIdx >= PIPELINE_STAGES.length - 1) return
    const nextStage = PIPELINE_STAGES[currentIdx + 1]

    if (COMP_REQUIRED_STAGES.has(nextStage) && entry.expected_comp == null) {
      setCompModal({ open: true, entry, nextStage, comp: '', saving: false })
      return
    }

    setAdvancingId(entry.id)

    // Optimistic update
    setPipelines(prev => prev.map(p => p.id === entry.id ? { ...p, current_stage: nextStage } : p))

    const [updateRes, historyRes] = await Promise.all([
      supabase
        .from('pipeline')
        .update({ current_stage: nextStage })
        .eq('id', entry.id),
      supabase
        .from('pipeline_stage_history')
        .insert({
          pipeline_id:  entry.id,
          recruiter_id: recruiter.id,
          stage:        nextStage,
        }),
    ])

    if (updateRes.error) {
      console.error('stage advance failed:', updateRes.error)
      // Roll back
      setPipelines(prev => prev.map(p => p.id === entry.id ? { ...p, current_stage: entry.current_stage } : p))
    } else {
      const allMotiv = debriefs.flatMap(d => Array.isArray(d.motivation_signals) ? d.motivation_signals : [])
      const allComp  = debriefs.flatMap(d => Array.isArray(d.competitive_signals) ? d.competitive_signals : [])
      const allRisk  = debriefs.flatMap(d => Array.isArray(d.risk_flags) ? d.risk_flags : [])
      const allHM    = debriefs.flatMap(d => Array.isArray(d.hiring_manager_signals) ? d.hiring_manager_signals : [])
      const allPos   = debriefs.flatMap(d => Array.isArray(d.positive_signals) ? d.positive_signals : [])

      const STAGE_GATE_ACTIONS = { interviewing: 'stage_gate_first_interview', offer: 'stage_gate_offer', placed: 'stage_gate_placed' }
      const stageGateAction = STAGE_GATE_ACTIONS[nextStage]

      let missingSignals = []
      if (nextStage === 'interviewing') {
        if (!allMotiv.length) missingSignals.push('motivation_read')
        if (!allHM.length)    missingSignals.push('hm_impression')
        if (!allPos.length && !allMotiv.length) missingSignals.push('candidate_energy')
      } else if (nextStage === 'offer') {
        if (!entry.expected_comp) missingSignals.push('comp_not_locked')
        if (!allComp.length)      missingSignals.push('competing_offers_unknown')
        const hasCounterCheck = allRisk.some(r => typeof r === 'string' && r.toLowerCase().includes('counter'))
        if (!hasCounterCheck)     missingSignals.push('counter_offer_risk_unassessed')
      } else if (nextStage === 'placed') {
        missingSignals.push('confirm_resignation_prep')
        if (allRisk.some(r => typeof r === 'string' && r.toLowerCase().includes('counter'))) {
          missingSignals.push('counter_offer_risk_active')
        }
      }

      fireResponse(stageGateAction ?? 'stage_advanced', {
        candidate: {
          id:            candidate?.id,
          name:          candidate ? `${candidate.first_name} ${candidate.last_name}` : null,
          current_title: candidate?.current_title,
        },
        from_stage:    entry.current_stage,
        to_stage:      nextStage,
        expected_comp: entry.expected_comp,
        role_title:    entry.roles?.title,
        has_debriefs:  debriefs.length > 0,
        risk_flags:    allRisk.slice(0, 3),
        motivation_signals: allMotiv.slice(0, 2),
        interactions_at_stage: interactions.filter(i => i.pipeline_id === entry.id).length,
        ...(stageGateAction ? { missing_signals: missingSignals } : {}),
      })
      // Auto-regenerate next action in background — no await, never blocks UI
      ;(async () => {
        try {
          const updatedPipelines = pipelines.map(p =>
            p.id === entry.id ? { ...p, current_stage: nextStage } : p
          )
          const messages = buildNextActionMessages(candidate, updatedPipelines, interactions)
          const text = await generateText({ messages, maxTokens: 512 })
          const trimmed = text.trim()
          if (!trimmed) return

          await supabase
            .from('candidates')
            .update({ enrichment_data: { ...(candidate.enrichment_data ?? {}), next_action: trimmed } })
            .eq('id', id)
          setSavedNextAction(trimmed)
        } catch {
          // Silent — next action stays as-is if generation fails
        }
      })()
    }
    if (historyRes.error) console.error('stage history insert failed:', historyRes.error)

    setAdvancingId(null)
  }

  async function handleCompModalSave() {
    const compValue = parseInt(compModal.comp, 10)
    if (!compValue || compValue <= 0) return
    setCompModal(prev => ({ ...prev, saving: true }))
    await supabase.from('pipeline').update({ expected_comp: compValue }).eq('id', compModal.entry.id)
    const updatedEntry = { ...compModal.entry, expected_comp: compValue }
    setPipelines(prev => prev.map(p => p.id === updatedEntry.id ? updatedEntry : p))
    setCompModal({ open: false, entry: null, nextStage: '', comp: '', saving: false })
    handleAdvanceStage(updatedEntry)
  }

  function handleLogOpen() {
    const today = new Date().toISOString().slice(0, 16) // "YYYY-MM-DDTHH:MM"
    setLogForm({ type: 'call', direction: 'outbound', occurred_at: today, body: '', confidence: '' })
    setLogError(null)
    setLogOpen(true)
  }

  async function handleLogSave() {
    if (!logForm.body.trim()) { setLogError('Notes are required.'); return }
    setLogSaving(true)
    setLogError(null)
    const payload = {
      recruiter_id: recruiter.id,
      candidate_id: id,
      type:         logForm.type,
      direction:    logForm.type === 'note' ? null : logForm.direction,
      occurred_at:  logForm.occurred_at || new Date().toISOString(),
      body:         logForm.body.trim(),
    }
    const { data, error } = await supabase
      .from('interactions')
      .insert(payload)
      .select()
      .single()
    if (error) {
      setLogError(error.message)
    } else {
      setInteractions(prev => [data, ...prev])
      setLogOpen(false)

      // Save pre-confidence if entered on a call/meeting with an active pipeline
      const preConf = logForm.confidence ? parseInt(logForm.confidence, 10) : null
      if (preConf && preConf >= 1 && preConf <= 10 && pipelines[0]) {
        const pipelineId = pipelines[0].id
        supabase.from('pipeline').update({ recruiter_confidence_pre: preConf }).eq('id', pipelineId)
        setPipelines(prev => prev.map(p => p.id === pipelineId ? { ...p, recruiter_confidence_pre: preConf } : p))
        ;(async () => {
          try {
            const { system, messages, maxTokens } = buildConfidenceScoreMessages('pre', {
              candidate, pipelineEntry: pipelines[0], debriefs, interactions,
            })
            const text = await generateText({ system, messages, maxTokens })
            const aiConf = parseInt(text.trim(), 10)
            if (aiConf >= 1 && aiConf <= 10) {
              await supabase.from('pipeline').update({ ai_confidence_pre: aiConf }).eq('id', pipelineId)
              setPipelines(prev => prev.map(p => p.id === pipelineId ? { ...p, ai_confidence_pre: aiConf } : p))
            }
          } catch { /* non-critical */ }
        })()
      }

      fireResponse('interaction_logged', {
        candidate: { id: candidate?.id, name: candidate ? `${candidate.first_name} ${candidate.last_name}` : null },
        interaction: { type: logForm.type, occurred_at: data.occurred_at },
        pipeline: pipelines[0] ? { id: pipelines[0].id, role_title: pipelines[0].roles?.title, current_stage: pipelines[0].current_stage } : null,
      })
    }
    setLogSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await Promise.all([
        supabase.from('pipeline').delete().eq('candidate_id', id),
        supabase.from('interactions').delete().eq('candidate_id', id),
        supabase.from('debriefs').delete().eq('candidate_id', id),
        supabase.from('screener_results').delete().eq('candidate_id', id),
        supabase.from('messages').delete().eq('candidate_id', id),
      ])
      const { error } = await supabase.from('candidates').delete().eq('id', id)
      if (error) throw error
      navigate('/network')
    } catch {
      setDeleteError('Delete failed. Try again.')
      setDeleting(false)
    }
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

  async function handleClearCareer() {
    setClearingCareer(true)
    const { error } = await supabase
      .from('candidates')
      .update({ career_timeline: null, career_signals: null })
      .eq('id', id)
    if (!error) {
      setTimeline(null)
      setSignals(null)
    }
    setClearCareerConfirm(false)
    setClearingCareer(false)
  }

  async function handleRemovePipeline(entryId) {
    const { error } = await supabase.from('pipeline').delete().eq('id', entryId)
    if (error) return error
    setPipelines(prev => prev.filter(p => p.id !== entryId))
    return null
  }

  async function handleDeleteInteraction(interactionId) {
    const { error } = await supabase.from('interactions').delete().eq('id', interactionId)
    if (error) return error
    setInteractions(prev => prev.filter(i => i.id !== interactionId))
    return null
  }

  async function handleDeleteScreenerResult(resultId) {
    const { error } = await supabase.from('screener_results').delete().eq('id', resultId)
    if (error) return error
    setScreenerHistory(prev => prev.filter(r => r.id !== resultId))
    return null
  }

  function handleOpenDebrief(interactionId) {
    const autoRoleId = pipelines.length === 1 ? pipelines[0].id : ''
    setDebriefModal({
      open: true,
      phase: 'input',
      interactionId,
      pipelineId: autoRoleId,
      raw: '',
      outcome: 'neutral',
      extracted: null,
      reviewSummary: '',
      reviewNextAction: '',
      error: null,
    })
  }

  function closeDebriefModal() {
    setDebriefModal(prev => ({ ...prev, open: false }))
  }

  async function handleExtractDebrief() {
    if (!debriefModal.raw.trim()) return
    setDebriefModal(prev => ({ ...prev, phase: 'extracting', error: null }))
    try {
      const role = pipelines.find(p => p.id === debriefModal.pipelineId)?.roles ?? null
      const stage = pipelines.find(p => p.id === debriefModal.pipelineId)?.current_stage ?? null
      const messages = buildDebriefExtractorMessages(candidate, role, stage, debriefs, debriefModal.raw)
      const raw = await generateText({ messages, maxTokens: 2048 })
      const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
      const extracted = JSON.parse(cleaned)
      setDebriefModal(prev => ({
        ...prev,
        phase: 'review',
        extracted,
        reviewSummary: extracted.summary ?? '',
        reviewNextAction: extracted.next_action ?? '',
      }))
    } catch (err) {
      setDebriefModal(prev => ({ ...prev, phase: 'error', error: err.message ?? 'Extraction failed.' }))
    }
  }

  async function handleSaveDebrief() {
    const { extracted, reviewSummary, reviewNextAction, confidence_post, interactionId, pipelineId, outcome, raw } = debriefModal
    if (!extracted) return
    setDebriefModal(prev => ({ ...prev, phase: 'saving' }))

    const pipeline = pipelines.find(p => p.id === pipelineId)

    const resolvedPipelineId = pipelineId || pipelines[0]?.id || null
    const resolvedPipeline   = pipelines.find(p => p.id === resolvedPipelineId) ?? null

    const payload = {
      recruiter_id:             recruiter.id,
      candidate_id:             id,
      pipeline_id:              resolvedPipelineId,
      role_id:                  resolvedPipeline?.role_id ?? null,
      interaction_id:           interactionId ?? null,
      outcome,
      feedback_raw:             raw,
      summary:                  reviewSummary,
      motivation_signals:       extracted.motivation_signals ?? [],
      competitive_signals:      extracted.competitive_signals ?? [],
      risk_flags:               extracted.risk_flags ?? [],
      positive_signals:         extracted.positive_signals ?? [],
      hiring_manager_signals:   extracted.hiring_manager_signals ?? [],
      objections:               extracted.risk_flags ?? [],
      strengths:                extracted.positive_signals ?? [],
      next_action:              reviewNextAction,
      questions_to_ask_next:    extracted.questions_to_ask_next ?? [],
      updates_to_record:        extracted.updates_to_record ?? [],
    }

    const { data: saved, error } = await supabase.from('debriefs').insert(payload).select().single()
    if (error) {
      console.error('debrief save failed:', error)
      setDebriefModal(prev => ({ ...prev, phase: 'error', error: `Save failed: ${error.message}` }))
      return
    }

    setDebriefs(prev => [saved, ...prev])

    fireResponse('debrief_saved', {
      candidate: { id: candidate?.id, name: candidate ? `${candidate.first_name} ${candidate.last_name}` : null },
      debrief: {
        summary:             saved.summary,
        risk_flags:          saved.risk_flags ?? [],
        motivation_signals:  saved.motivation_signals ?? [],
        competitive_signals: saved.competitive_signals ?? [],
        next_action:         saved.next_action,
      },
      pipeline: resolvedPipeline ? { id: resolvedPipeline.id, role_title: resolvedPipeline.roles?.title, current_stage: resolvedPipeline.current_stage } : null,
    })

    // Update pipeline next_action if we have a pipeline entry
    if (resolvedPipelineId && reviewNextAction) {
      await supabase
        .from('pipeline')
        .update({ next_action: reviewNextAction })
        .eq('id', resolvedPipelineId)
      setPipelines(prev => prev.map(p =>
        p.id === resolvedPipelineId ? { ...p, next_action: reviewNextAction } : p
      ))
    }

    // Surface latest summary on the candidate-level next action
    if (reviewNextAction) {
      await supabase
        .from('candidates')
        .update({ enrichment_data: { ...(candidate.enrichment_data ?? {}), next_action: reviewNextAction } })
        .eq('id', id)
      setSavedNextAction(reviewNextAction)
    }

    closeDebriefModal()

    // Save post-confidence and check divergence in background
    const postConf = confidence_post ? parseInt(confidence_post, 10) : null
    if (postConf && postConf >= 1 && postConf <= 10 && resolvedPipelineId) {
      supabase.from('pipeline').update({ recruiter_confidence_post: postConf }).eq('id', resolvedPipelineId)
      setPipelines(prev => prev.map(p => p.id === resolvedPipelineId ? { ...p, recruiter_confidence_post: postConf } : p))
      ;(async () => {
        try {
          const freshDebriefs = [saved, ...debriefs]
          const { system, messages, maxTokens } = buildConfidenceScoreMessages('post', {
            candidate, pipelineEntry: resolvedPipeline, debriefs: freshDebriefs, interactions,
          })
          const text = await generateText({ system, messages, maxTokens })
          const aiConf = parseInt(text.trim(), 10)
          if (aiConf >= 1 && aiConf <= 10) {
            await supabase.from('pipeline').update({ ai_confidence_post: aiConf }).eq('id', resolvedPipelineId)
            setPipelines(prev => prev.map(p => p.id === resolvedPipelineId ? { ...p, ai_confidence_post: aiConf } : p))
            if (Math.abs(postConf - aiConf) >= 3) {
              fireResponse('confidence_divergence', {
                candidate: { id: candidate?.id, name: candidate ? `${candidate.first_name} ${candidate.last_name}` : null },
                recruiter_confidence: postConf,
                ai_confidence: aiConf,
                divergence: Math.abs(postConf - aiConf),
                direction: postConf > aiConf ? 'recruiter_higher' : 'wren_higher',
                role_title: resolvedPipeline?.roles?.title,
              })
            }
          }
        } catch { /* non-critical */ }
      })()
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
      if (error.code === '23505') {
        setAddError('Already in pipeline for this role.')
      } else {
        setAddError('Couldn\'t add to pipeline. Try again.')
      }
    } else {
      setPipelines(prev => [...prev, entry])
      setPickerOpen(false)

      // Auto-screen in background — no await, never blocks UI
      if (candidate?.cv_text && role.notes) {
        ;(async () => {
          try {
            const messages = buildScreenerMessages(candidate, role)
            const raw = await generateText({ messages, maxTokens: 2048 })
            const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
            const result = JSON.parse(cleaned)

            const { data: savedResult, error: srErr } = await supabase
              .from('screener_results')
              .insert({ recruiter_id: recruiter.id, candidate_id: id, role_id: role.id, result })
              .select()
              .single()
            if (!srErr) setScreenerHistory(prev => [savedResult, ...prev])

            if (result.match_score != null) {
              const fitScore = Math.min(100, Math.round(result.match_score * 10))
              const rationale = result.recommendation_reason ?? null
              await supabase
                .from('pipeline')
                .update({ fit_score: fitScore, fit_score_rationale: rationale })
                .eq('id', entry.id)
              setPipelines(prev => prev.map(p =>
                p.id === entry.id ? { ...p, fit_score: fitScore, fit_score_rationale: rationale } : p
              ))
            }
          } catch {
            // Silent — screener failed, candidate is still in pipeline unscored
          }
        })()
      }
    }
    setAddingRoleId(null)
  }

  // ── Scorecard handler ────────────────────────────────────

  async function handleGenerateScorecard() {
    const role = openRoles?.find(r => r.id === screenerRoleId)
    if (!role || !candidate?.cv_text) return
    setScorecard(null)
    setScorecardError(null)
    setScorecardGenerating(true)
    try {
      const messages = buildScorecardMessages(candidate, role, screenResult)
      const raw = await generateText({ messages, maxTokens: 1024 })
      const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
      const result = JSON.parse(cleaned)
      setScorecard(result)

      // Persist to pipeline entry for this candidate × role (may not exist yet)
      const { data: freshEntry } = await supabase
        .from('pipeline')
        .select('id')
        .eq('candidate_id', id)
        .eq('role_id', screenerRoleId)
        .maybeSingle()
      if (freshEntry) {
        const { error: scErr } = await supabase
          .from('pipeline')
          .update({ scorecard_result: result })
          .eq('id', freshEntry.id)
        if (scErr) console.error('scorecard save failed:', scErr)
      }
    } catch (err) {
      setScorecardError(err.message ?? 'Scorecard generation failed.')
    } finally {
      setScorecardGenerating(false)
    }
  }

  // ── Candidate pitch handler ──────────────────────────────

  async function handleGeneratePitch() {
    const role = openRoles?.find(r => r.id === screenerRoleId)
    if (!role || !candidate) return
    setPitchText(null)
    setPitchError(null)
    setPitchSaved(false)
    setPitchGenerating(true)
    try {
      const messages = buildCandidatePitchMessages(candidate, role)
      const text = await generateText({ messages, maxTokens: 1024 })
      setPitchText(text)
    } catch (err) {
      setPitchError(err.message ?? 'Pitch generation failed.')
    } finally {
      setPitchGenerating(false)
    }
  }

  async function handleSavePitch() {
    if (!pitchText || pitchSaving) return
    setPitchSaving(true)
    const role = openRoles?.find(r => r.id === screenerRoleId)
    const roleKey = role ? `pitch_${role.id}` : 'pitch_general'
    const { error } = await supabase
      .from('candidates')
      .update({
        enrichment_data: {
          ...(candidate.enrichment_data || {}),
          [roleKey]: pitchText,
        },
      })
      .eq('id', id)
    if (!error) setPitchSaved(true)
    setPitchSaving(false)
  }

  // ── Outreach email handlers ──────────────────────────────

  function openOutreachModal() {
    setOutreachModal({ open: true, phase: 'pick', roleId: '', result: null, error: null })
  }

  function closeOutreachModal() {
    setOutreachModal({ open: false, phase: 'pick', roleId: '', result: null, error: null })
  }

  async function handleGenerateOutreach() {
    const role = outreachModal.roleId
      ? openRoles?.find(r => r.id === outreachModal.roleId) ?? null
      : null

    setOutreachModal(prev => ({ ...prev, phase: 'generating', result: null, error: null }))

    try {
      const messages = buildOutreachEmailMessages(candidate, role)
      const raw = await generateText({ messages, maxTokens: 512 })
      const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
      const result = JSON.parse(cleaned)
      setOutreachModal(prev => ({ ...prev, phase: 'done', result }))
    } catch (err) {
      setOutreachModal(prev => ({ ...prev, phase: 'error', error: err.message ?? 'Generation failed.' }))
    }
  }

  // ── LinkedIn message handlers ────────────────────────────

  function openLinkedinModal() {
    setLinkedinModal({ open: true, phase: 'pick', roleId: '', text: null, error: null })
  }

  function closeLinkedinModal() {
    setLinkedinModal({ open: false, phase: 'pick', roleId: '', text: null, error: null })
  }

  async function handleGenerateLinkedIn() {
    const role = linkedinModal.roleId
      ? openRoles?.find(r => r.id === linkedinModal.roleId) ?? null
      : null

    setLinkedinModal(prev => ({ ...prev, phase: 'generating', text: null, error: null }))

    try {
      const messages = buildLinkedInMessageMessages(candidate, role, recruiter)
      const text = await generateText({ messages, maxTokens: 256 })
      setLinkedinModal(prev => ({ ...prev, phase: 'done', text: text.trim() }))
    } catch (err) {
      setLinkedinModal(prev => ({ ...prev, phase: 'error', error: err.message ?? 'Generation failed.' }))
    }
  }

  // ── Submission draft handlers ────────────────────────────

  function openSubModal() {
    setSubModal({ open: true, phase: 'pick', format: 'email', mode: null, roleId: '', text: '', error: null })
    setSubSaved(false)
  }

  function closeSubModal() {
    setSubModal({ open: false, phase: 'pick', format: 'email', mode: null, roleId: '', text: '', error: null })
    setSubSaved(false)
  }

  async function handleSubGenerate() {
    const { format, mode, roleId } = subModal
    setSubModal(prev => ({ ...prev, phase: 'generating', text: '', error: null }))
    setSubSaved(false)

    try {
      let role
      if (mode === 'jd') {
        const found = openRoles?.find(r => r.id === roleId)
        if (!found) throw new Error('Role not found.')
        // Find matching pipeline entry for fit score
        const pipelineEntry = pipelines.find(p => p.role_id === roleId)
        role = found
        const messages = buildSubmissionMessages(candidate, role, pipelineEntry?.fit_score ?? null, format)
        const text = await generateText({ messages, maxTokens: 1024 })
        setSubModal(prev => ({ ...prev, phase: 'done', text }))
      } else {
        // Generic — no JD, no role context
        const genericRole = { title: 'Open Role', clients: null, notes: null, comp_min: null, comp_max: null, comp_type: null }
        const messages = buildSubmissionMessages(candidate, genericRole, null, format)
        const text = await generateText({ messages, maxTokens: 1024 })
        setSubModal(prev => ({ ...prev, phase: 'done', text }))
      }
    } catch (err) {
      setSubModal(prev => ({ ...prev, phase: 'error', error: err.message ?? 'Generation failed.' }))
    }
  }

  async function handleSubSaveToQueue() {
    if (!subModal.text || subSaving) return
    setSubSaving(true)
    const roleName = subModal.mode === 'jd'
      ? openRoles?.find(r => r.id === subModal.roleId)?.title ?? 'Role'
      : 'General Submission'
    const subject = `${candidate.first_name} ${candidate.last_name} — ${roleName}`
    const { error } = await supabase.from('messages').insert({
      recruiter_id:  recruiter.id,
      candidate_id:  id,
      channel:       'email',
      subject,
      body:          subModal.text,
      status:        'drafted',
    })
    if (!error) setSubSaved(true)
    setSubSaving(false)
  }

  // ── New handlers ────────────────────────────────────────

  async function handleEditInteractionSave(interactionId, updates) {
    const { error } = await supabase
      .from('interactions')
      .update(updates)
      .eq('id', interactionId)
    if (error) return error
    setInteractions(prev => prev.map(i => i.id === interactionId ? { ...i, ...updates } : i))
    setEditInteractionModal({ open: false, interaction: null, linkedDebriefId: null })
    return null
  }

  function handleOpenEditInteraction(interaction) {
    const linkedDebriefId = debriefs.find(d => d.interaction_id === interaction.id)?.id ?? null
    setEditInteractionModal({ open: true, interaction, linkedDebriefId })
  }

  async function handleScreenForRole(roleId) {
    const role = openRoles?.find(r => r.id === roleId)
    if (!role || !candidate) return
    setScreenerRoleId(roleId)
    setScreenResult(null)
    setScreenError(null)
    setScreeningInline(true)
    setScreening(true)
    try {
      const messages = buildScreenerMessages(candidate, role)
      const raw = await generateText({ messages, maxTokens: 2048 })
      const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
      const result = JSON.parse(cleaned)
      setScreenResult(result)

      const { data: savedResult, error: srErr } = await supabase
        .from('screener_results')
        .insert({ recruiter_id: recruiter.id, candidate_id: id, role_id: roleId, result })
        .select().single()
      if (!srErr) setScreenerHistory(prev => [savedResult, ...prev])

      const { data: freshEntry } = await supabase
        .from('pipeline').select('id').eq('candidate_id', id).eq('role_id', roleId).maybeSingle()
      if (freshEntry && result.match_score != null) {
        const fitScore = result.match_score * 10
        const rationale = result.recommendation_reason ?? null
        await supabase.from('pipeline').update({ fit_score: fitScore, fit_score_rationale: rationale, screener_result: result }).eq('id', freshEntry.id)
        setPipelines(prev => prev.map(p => p.id === freshEntry.id ? { ...p, fit_score: fitScore, fit_score_rationale: rationale } : p))
      }
    } catch (err) {
      setScreenError(err.message ?? 'Screening failed.')
    } finally {
      setScreening(false)
    }
  }

  async function handleZoneBPitch() {
    const primaryRole = openRoles?.find(r => r.id === pipelines[0]?.role_id)
    if (!primaryRole || !candidate) return
    setZoneBPitch({ generating: true, result: null, error: null })
    try {
      const text = await generateText({ messages: buildCandidatePitchMessages(candidate, primaryRole), maxTokens: 1024 })
      setZoneBPitch({ generating: false, result: text, error: null })
    } catch (err) {
      setZoneBPitch({ generating: false, result: null, error: err.message ?? 'Failed.' })
    }
  }

  async function handleZoneBInterviewQuestions() {
    const primary = pipelines[0]
    const primaryRole = openRoles?.find(r => r.id === primary?.role_id)
    if (!primaryRole) return
    const latestScreenResult = screenerHistory.find(s => s.role_id === primaryRole.id)?.result ?? null
    setZoneBIQ({ generating: true, result: null, error: null })
    try {
      const text = await generateText({ messages: buildInterviewQuestionMessages(primaryRole, latestScreenResult), maxTokens: 1024 })
      setZoneBIQ({ generating: false, result: text, error: null })
    } catch (err) {
      setZoneBIQ({ generating: false, result: null, error: err.message ?? 'Failed.' })
    }
  }

  async function handleExpandPipelineHistory() {
    setCollapsePipeline(false)
    if (stageHistory !== null) return
    setStageHistoryLoading(true)
    const pipelineIds = pipelines.map(p => p.id)
    if (!pipelineIds.length) { setStageHistory([]); setStageHistoryLoading(false); return }
    const { data } = await supabase
      .from('pipeline_stage_history')
      .select('*')
      .in('pipeline_id', pipelineIds)
      .order('entered_at', { ascending: true })
    setStageHistory(data ?? [])
    setStageHistoryLoading(false)
  }

  async function handleCallPrep(prepType) {
    setCallPrepResult({ type: prepType, loading: true, result: null, error: null })
    try {
      const { system, messages, maxTokens } = buildCallPrepMessages(prepType, {
        candidate,
        pipelineEntry: pipelines[0] ?? null,
        debriefs,
        interactions,
      })
      const text = await generateText({ system, messages, maxTokens })
      setCallPrepResult({ type: prepType, loading: false, result: text.trim(), error: null })
    } catch {
      setCallPrepResult({ type: prepType, loading: false, result: null, error: 'Couldn\'t generate call prep. Try again.' })
    }
  }

  function handleZoneAAction(action) {
    if (action.id === 'prep_interview') { handleCallPrep('prep_interview'); return }
    if (action.id === 'lock_comp')      { handleCallPrep('lock_comp'); return }
    if (action.id === 'prep_counter')   { handleCallPrep('prep_counter'); return }
    setZoneAStub(null)
    if (action.id === 'log_debrief')    handleOpenDebrief(null)
    if (action.id === 'log_interaction') handleLogOpen()
    if (action.id === 'add_to_role')    handleOpenPicker()
    if (action.id === 'screen_role') {
      const roleId = pipelines[0]?.role_id
      if (roleId) handleScreenForRole(roleId)
    }
  }

  async function handleMarkPlaced() {
    const primary = pipelines[0]
    if (!primary) return
    const placed = PIPELINE_STAGES[PIPELINE_STAGES.length - 1]
    if (primary.current_stage?.toLowerCase() === placed) return
    // Advance to placed directly
    const currentIdx = PIPELINE_STAGES.indexOf(primary.current_stage?.toLowerCase())
    if (currentIdx < 0) return
    // Advance through stages to placed
    await handleAdvanceStage({ ...primary, current_stage: PIPELINE_STAGES[PIPELINE_STAGES.length - 2] })
  }

  // ── Render states ────────────────────────────────────────

  if (loading) {
    return <AppLayout><div className="loading-state"><div className="spinner" /></div></AppLayout>
  }

  if (notFound) {
    return (
      <AppLayout>
        <div className="page-error">
          <p className="page-error-title">Candidate not found.</p>
          <p className="page-error-body">This record may have been deleted or you may not have access.</p>
          <button className="btn-ghost" onClick={() => navigate('/network')}>Back to Network</button>
        </div>
      </AppLayout>
    )
  }

  const fullName = `${candidate.first_name} ${candidate.last_name}`

  const topPipelineEntry = pipelines.length > 0
    ? pipelines.reduce((best, p) => {
        if (!best) return p
        return (p.fit_score ?? -1) > (best.fit_score ?? -1) ? p : best
      }, null)
    : null

  return (
    <AppLayout>

        {/* Page header — back + Zone C only */}
        <div className="page-header">
          <div className="page-header-left">
            <button className="btn-back" onClick={() => navigate('/network')}>← Back</button>
          </div>
          <div className="page-header-actions" style={{ position: 'relative' }}>
            <button className="btn-ghost btn-sm" onClick={() => setZoneCOpen(v => !v)}>⋯ More</button>
            {zoneCOpen && (
              <ZoneCMenu
                candidate={candidate}
                pipelines={pipelines}
                onEdit={() => navigate(`/network/${id}/edit`)}
                onCallMode={() => navigate(`/network/${id}/call`)}
                onRemoveFromPipeline={() => {
                  const primary = pipelines[0]
                  if (primary) handleRemovePipeline(primary.id)
                }}
                onMarkPlaced={handleMarkPlaced}
                onDeleteCandidate={() => setConfirmDelete(true)}
                onClose={() => setZoneCOpen(false)}
              />
            )}
          </div>
        </div>

        {/* Delete candidate inline confirm */}
        {confirmDelete && (
          <div className="inline-confirm" style={{ marginBottom: 12 }}>
            <span>Delete {candidate.first_name} {candidate.last_name}? This cannot be undone.</span>
            <button className="btn-confirm-yes" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button className="btn-confirm-cancel" onClick={() => { setConfirmDelete(false); setDeleteError(null) }}>
              Cancel
            </button>
          </div>
        )}
        {deleteError && <p className="inline-error" style={{ marginBottom: 12 }}>{deleteError}</p>}

        {/* Deal Status Bar */}
        <DealStatusBar
          candidate={candidate}
          pipelines={pipelines}
          debriefs={debriefs}
          interactions={interactions}
          onOpenComp={entry => setCompModal({ open: true, entry, nextStage: entry.current_stage, comp: '', saving: false })}
          onOpenPicker={handleOpenPicker}
        />

        {/* Single column body */}
        <div className="cc-body">

          {/* Latest debrief summary */}
          {debriefs.length > 0 && (
            <LatestDebriefSummaryCard
              debrief={debriefs[0]}
              onNewDebrief={() => handleOpenDebrief(null)}
              onExpand={() => setCollapseAllDebriefs(false)}
            />
          )}

          {/* Debrief signals panel */}
          {debriefs.length > 0 && (
            <section className="candidate-section">
              <div className="section-heading-row">
                <h2 className="section-heading">Debrief Signals</h2>
                <span className="muted" style={{ fontSize: 12 }}>{debriefs.length} debrief{debriefs.length > 1 ? 's' : ''}</span>
              </div>
              <DebriefSignalPanel debriefs={debriefs} onOpenDebrief={() => handleOpenDebrief(null)} />
            </section>
          )}

          {/* Actions — Zone A, B, C */}
          <section className="candidate-section action-zones">
            {/* Zone A: Work this deal */}
            <div className="zone-a">
              <span className="zone-label">Work this deal</span>
              <div className="zone-a-actions">
                {computeZoneAActions({ pipelines, interactions, debriefs }).map(action => (
                  <button
                    key={action.id}
                    className="zone-a-btn"
                    onClick={() => handleZoneAAction(action)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
              {/* Screening inline result */}
              {screeningInline && (
                <div style={{ marginTop: 12 }}>
                  {screening && <div className="modal-generating"><div className="spinner spinner--sm" />Screening…</div>}
                  {screenError && <p className="error">{screenError}</p>}
                  {screenResult && <ScreenerResult result={screenResult} />}
                </div>
              )}
              {/* Call prep result */}
              {callPrepResult.type && (
                <div className="zone-b-result" style={{ marginTop: 12 }}>
                  <div className="zone-b-result-header">
                    <span className="screener-block-label">
                      {callPrepResult.type === 'prep_interview' ? 'Interview Prep'
                        : callPrepResult.type === 'lock_comp' ? 'Comp Lock Prep'
                        : 'Counter Offer Prep'}
                    </span>
                    {callPrepResult.result && (
                      <button className="btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(callPrepResult.result)}>Copy</button>
                    )}
                    <button className="btn-ghost btn-sm" onClick={() => setCallPrepResult({ type: null, loading: false, result: null, error: null })}>✕</button>
                  </div>
                  {callPrepResult.loading && (
                    <div className="modal-generating"><div className="spinner spinner--sm" />Generating call prep…</div>
                  )}
                  {callPrepResult.error && <p className="error">{callPrepResult.error}</p>}
                  {callPrepResult.result && (
                    <p className="pitch-body" style={{ whiteSpace: 'pre-wrap' }}>{callPrepResult.result}</p>
                  )}
                </div>
              )}
            </div>

            {/* Zone B: Generate */}
            <div className="zone-b">
              <span className="zone-label">Generate</span>
              <div className="zone-b-actions">
                <button className="btn-ghost btn-sm" onClick={openSubModal}>Draft submission</button>
                <button className="btn-ghost btn-sm" onClick={openOutreachModal}>Draft outreach</button>
                <button className="btn-ghost btn-sm" onClick={openLinkedinModal}>Draft LinkedIn</button>
                <button
                  className="btn-ghost btn-sm"
                  disabled={!pipelines.length || zoneBPitch.generating}
                  onClick={handleZoneBPitch}
                >
                  {zoneBPitch.generating ? 'Generating…' : 'Generate pitch'}
                </button>
                <button
                  className="btn-ghost btn-sm"
                  disabled={!pipelines.length || zoneBIQ.generating}
                  onClick={handleZoneBInterviewQuestions}
                >
                  {zoneBIQ.generating ? 'Generating…' : 'Interview questions'}
                </button>
              </div>
              {zoneBPitch.result && (
                <div className="zone-b-result">
                  <div className="zone-b-result-header">
                    <span className="screener-block-label">Pitch</span>
                    <button className="btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(zoneBPitch.result)}>Copy</button>
                    <button className="btn-ghost btn-sm" onClick={() => setZoneBPitch(s => ({ ...s, result: null }))}>✕</button>
                  </div>
                  <p className="pitch-body">{zoneBPitch.result}</p>
                </div>
              )}
              {zoneBIQ.result && (
                <div className="zone-b-result">
                  <div className="zone-b-result-header">
                    <span className="screener-block-label">Interview Questions</span>
                    <button className="btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(zoneBIQ.result)}>Copy</button>
                    <button className="btn-ghost btn-sm" onClick={() => setZoneBIQ(s => ({ ...s, result: null }))}>✕</button>
                  </div>
                  <p className="pitch-body" style={{ whiteSpace: 'pre-wrap' }}>{zoneBIQ.result}</p>
                </div>
              )}
            </div>
          </section>

          {/* Log interaction form */}
          {logOpen && (
            <section className="candidate-section">
              <div className="log-form">
                <div className="log-form-row">
                  <select className="log-select" value={logForm.type} onChange={e => setLogForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="call">Call</option>
                    <option value="email">Email</option>
                    <option value="note">Note</option>
                    <option value="meeting">Meeting</option>
                  </select>
                  {logForm.type !== 'note' && (
                    <select className="log-select" value={logForm.direction} onChange={e => setLogForm(f => ({ ...f, direction: e.target.value }))}>
                      <option value="outbound">Outbound</option>
                      <option value="inbound">Inbound</option>
                    </select>
                  )}
                  <input type="datetime-local" className="log-date" value={logForm.occurred_at} onChange={e => setLogForm(f => ({ ...f, occurred_at: e.target.value }))} />
                </div>
                <textarea className="log-textarea" placeholder="Notes…" rows={3} value={logForm.body} onChange={e => setLogForm(f => ({ ...f, body: e.target.value }))} />
                {(logForm.type === 'call' || logForm.type === 'meeting') && (
                  <div className="confidence-inline">
                    <label className="confidence-label">Your confidence on this candidate? (1–10)</label>
                    <input
                      type="number" min="1" max="10"
                      className="confidence-input"
                      placeholder="—"
                      value={logForm.confidence}
                      onChange={e => setLogForm(f => ({ ...f, confidence: e.target.value }))}
                    />
                  </div>
                )}
                {logError && <p className="error" style={{ marginTop: 4 }}>{logError}</p>}
                <div className="log-form-actions">
                  <button className="btn-primary btn-sm" onClick={handleLogSave} disabled={logSaving}>{logSaving ? 'Saving…' : 'Save'}</button>
                  <button className="btn-ghost btn-sm" onClick={() => setLogOpen(false)}>Cancel</button>
                </div>
              </div>
            </section>
          )}

          {/* Interactions log */}
          <section className="candidate-section">
            <div className="section-heading-row">
              <h2 className="section-heading">Interactions</h2>
              <button className="btn-ghost btn-sm" onClick={handleLogOpen}>+ Log</button>
            </div>
            {interactions.length === 0 ? (
              <p className="muted" style={{ marginTop: 4 }}>No interactions logged yet.</p>
            ) : (
              <div className="interaction-feed">
                {(showAllInteractions ? interactions : interactions.slice(0, 3)).map(i => {
                  const hasDebrief = debriefs.some(d => d.interaction_id === i.id)
                  return (
                    <InteractionEntry
                      key={i.id}
                      interaction={i}
                      onDelete={handleDeleteInteraction}
                      hasDebrief={hasDebrief}
                      onDebrief={handleOpenDebrief}
                      onEdit={handleOpenEditInteraction}
                    />
                  )
                })}
                {interactions.length > 3 && (
                  <button className="btn-ghost btn-sm interactions-more-btn" onClick={() => setShowAllInteractions(v => !v)}>
                    {showAllInteractions ? `Show less` : `Show ${interactions.length - 3} more`}
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Pipeline context (collapsed) */}
          <CollapsibleSection
            title="Pipeline"
            collapsed={collapsePipeline}
            badge={pipelines.length > 0 ? `${pipelines.length} role${pipelines.length > 1 ? 's' : ''}` : null}
            onToggle={handleExpandPipelineHistory}
          >
            <button className="btn-ghost btn-sm" onClick={handleOpenPicker} style={{ marginBottom: 12 }}>
              {pickerOpen ? 'Cancel' : '+ Add to Role'}
            </button>
            {pickerOpen && (
              <div className="role-picker">
                {openRoles?.length === 0 ? (
                  <p className="muted" style={{ padding: '10px 0' }}>No open roles.</p>
                ) : (
                  <ul className="role-picker-list">
                    {openRoles?.map(role => {
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
                            {role.clients?.name && <span className="role-picker-client">{role.clients.name}</span>}
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
            {pipelines.filter(p => ['interviewing','offer','placed'].includes(p.current_stage?.toLowerCase()) && p.expected_comp == null).map(p => (
              <CompPrompt key={p.id + '-comp'} entry={p} onSave={async (val) => {
                await supabase.from('pipeline').update({ expected_comp: val }).eq('id', p.id)
                setPipelines(prev => prev.map(pe => pe.id === p.id ? { ...pe, expected_comp: val } : pe))
              }} />
            ))}
            {pipelines.length === 0 ? (
              <p className="muted" style={{ marginTop: 8 }}>Not in any pipeline yet.</p>
            ) : (
              pipelines.map(entry => (
                <PipelineEntry key={entry.id} entry={entry} onAdvance={handleAdvanceStage} advancing={advancingId === entry.id} onRemove={handleRemovePipeline} />
              ))
            )}
            {stageHistoryLoading && <div className="modal-generating" style={{ marginTop: 12 }}><div className="spinner spinner--sm" />Loading history…</div>}
            {stageHistory?.length > 0 && (
              <div className="stage-history-log">
                <p className="screener-block-label" style={{ marginTop: 16 }}>Stage History</p>
                {stageHistory.map((sh, i) => (
                  <div key={sh.id ?? i} className="stage-history-row">
                    <span className="stage-badge">{sh.stage}</span>
                    <span className="interaction-date">{formatDateShort(sh.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* Resume & Career Timeline (collapsed) */}
          <CollapsibleSection
            title="Resume & Career Timeline"
            collapsed={collapseResume}
            onToggle={() => setCollapseResume(v => !v)}
          >
            {parsingCareer && <div className="modal-generating" style={{ marginTop: 8 }}><div className="spinner spinner--sm" />Parsing career history…</div>}
            {careerError && <div className="ai-card ai-card--error" style={{ marginTop: 8 }}><p className="ai-card-eyebrow">Error</p><p className="ai-card-body">Couldn't parse career history.</p></div>}
            {!candidate.cv_text && <p className="muted" style={{ marginTop: 8 }}>No CV on file.</p>}
            {timeline !== null && (
              <>
                {(() => { const s = computeTenureSummary(timeline); return s ? <TenureSummary summary={s} /> : null })()}
                {timeline.length === 0
                  ? <p className="muted">No career history could be extracted.</p>
                  : timeline.map((entry, i) => <CareerEntry key={i} entry={entry} />)
                }
              </>
            )}
            {candidate.cv_text && (
              <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                <button className="btn-ghost btn-sm" onClick={handleParseCareer} disabled={parsingCareer}>
                  {parsingCareer ? 'Parsing…' : timeline ? 'Reparse timeline' : 'Parse timeline'}
                </button>
                {timeline && !clearCareerConfirm && (
                  <button className="btn-ghost btn-sm" onClick={() => setClearCareerConfirm(true)}>Clear</button>
                )}
              </div>
            )}
            {clearCareerConfirm && (
              <div className="inline-confirm">
                <span>Clear career data?</span>
                <button className="btn-confirm-yes" onClick={handleClearCareer} disabled={clearingCareer}>
                  {clearingCareer ? 'Clearing…' : 'Yes, clear'}
                </button>
                <button className="btn-confirm-cancel" onClick={() => setClearCareerConfirm(false)}>Cancel</button>
              </div>
            )}
            {candidate.cv_text && (
              <div className="cv-raw" style={{ marginTop: 16 }}>
                <p className="screener-block-label">Raw CV</p>
                <pre className="cv-raw-text">{candidate.cv_text}</pre>
              </div>
            )}
          </CollapsibleSection>

          {/* All debriefs (collapsed) */}
          {debriefs.length > 0 && (
            <CollapsibleSection
              title="All Debriefs"
              collapsed={collapseAllDebriefs}
              badge={String(debriefs.length)}
              onToggle={() => setCollapseAllDebriefs(v => !v)}
            >
              {debriefs.map(d => {
                const cls = { advance: 'debrief-outcome--advance', reject: 'debrief-outcome--reject', hold: 'debrief-outcome--hold', neutral: 'debrief-outcome--neutral' }[d.outcome] ?? ''
                return (
                  <div key={d.id} className="debrief-summary-card" style={{ marginBottom: 12 }}>
                    <div className="dsc-header">
                      <span className={`debrief-outcome-badge ${cls}`}>{d.outcome}</span>
                      <span className="dsc-date">{formatDateShort(d.captured_at)}</span>
                    </div>
                    {d.summary && <p className="dsc-summary">{d.summary}</p>}
                    {DEBRIEF_SIGNAL_CATS.map(cat => {
                      const items = d[cat.key]
                      if (!items?.length) return null
                      return (
                        <div key={cat.key} className="debrief-signal-cat" style={{ marginTop: 8 }}>
                          <span className={`debrief-signal-cat-label ${cat.cls}`}>{cat.label}</span>
                          <ul className="debrief-signal-list">{items.map((item, i) => <li key={i}>{item}</li>)}</ul>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </CollapsibleSection>
          )}

          {/* Career signals (collapsed) */}
          {signals?.length > 0 && (
            <CollapsibleSection
              title="Career Signals"
              collapsed={collapseSignals}
              onToggle={() => setCollapseSignals(v => !v)}
            >
              <SignalBadges signals={signals} />
            </CollapsibleSection>
          )}

          {/* Screener results (collapsed) */}
          {screenerHistory.length > 0 && (
            <CollapsibleSection
              title="Screener Results"
              collapsed={collapseScoreHistory}
              badge={String(screenerHistory.length)}
              onToggle={() => setCollapseScoreHistory(v => !v)}
            >
              <div className="scores-history">
                {screenerHistory.map(sr => (
                  <ScoreHistoryRow key={sr.id} sr={sr} inPipeline={pipelines.some(p => p.role_id === sr.role_id)} onDelete={handleDeleteScreenerResult} />
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Edit candidate link */}
          <section className="candidate-section">
            <Link className="btn-ghost btn-sm" to={`/network/${id}/edit`}>Edit candidate →</Link>
          </section>

        </div>

      {/* LinkedIn message modal */}
      {linkedinModal.open && (
        <div className="modal-overlay" onClick={closeLinkedinModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Draft LinkedIn Message</h2>
                <p className="modal-subtitle">{candidate.first_name} {candidate.last_name} · 300 characters max</p>
              </div>
              <button className="modal-close" onClick={closeLinkedinModal}>✕</button>
            </div>

            {linkedinModal.phase === 'pick' && (
              <>
                <div className="sub-mode-section">
                  <p className="sub-mode-label">Role (optional)</p>
                  <p className="sub-mode-hint">Personalizes the message against a specific role and comp range.</p>
                  <select
                    className="field-input"
                    value={linkedinModal.roleId}
                    onChange={e => setLinkedinModal(prev => ({ ...prev, roleId: e.target.value }))}
                  >
                    <option value="">No role — general message</option>
                    {openRoles?.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.title}{r.clients?.name ? ` — ${r.clients.name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="modal-actions">
                  <button className="btn-primary" onClick={handleGenerateLinkedIn}>Generate</button>
                  <button className="btn-ghost" onClick={closeLinkedinModal}>Cancel</button>
                </div>
              </>
            )}

            {linkedinModal.phase === 'generating' && (
              <div className="modal-generating">
                <div className="spinner spinner--sm" />
                Drafting message…
              </div>
            )}

            {linkedinModal.phase === 'error' && (
              <p className="error" style={{ marginTop: 8 }}>Couldn't generate the message. Try again.</p>
            )}

            {linkedinModal.phase === 'done' && linkedinModal.text && (
              <>
                <div className="outreach-field">
                  <div className="outreach-field-header">
                    <p className="sub-mode-label">
                      Message
                      <span className={`char-count${linkedinModal.text.length > 300 ? ' char-count--over' : ''}`}>
                        {' '}· {linkedinModal.text.length}/300
                      </span>
                    </p>
                    <button
                      className="btn-ghost btn-sm"
                      onClick={() => navigator.clipboard.writeText(linkedinModal.text)}
                    >Copy</button>
                  </div>
                  <p className="outreach-body">{linkedinModal.text}</p>
                </div>
                <div className="modal-actions">
                  <button className="btn-ghost" onClick={handleGenerateLinkedIn}>Regenerate</button>
                  <button className="btn-ghost" onClick={closeLinkedinModal}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Outreach email modal */}
      {outreachModal.open && (
        <div className="modal-overlay" onClick={closeOutreachModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Draft Outreach</h2>
                <p className="modal-subtitle">{candidate.first_name} {candidate.last_name}</p>
              </div>
              <button className="modal-close" onClick={closeOutreachModal}>✕</button>
            </div>

            {outreachModal.phase === 'pick' && (
              <>
                <div className="sub-mode-section">
                  <p className="sub-mode-label">Role (optional)</p>
                  <p className="sub-mode-hint">Personalizes the email against a specific JD and comp range. Leave blank for a general outreach.</p>
                  <select
                    className="field-input"
                    value={outreachModal.roleId}
                    onChange={e => setOutreachModal(prev => ({ ...prev, roleId: e.target.value }))}
                  >
                    <option value="">No role — general outreach</option>
                    {openRoles?.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.title}{r.clients?.name ? ` — ${r.clients.name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="modal-actions">
                  <button className="btn-primary" onClick={handleGenerateOutreach}>Generate</button>
                  <button className="btn-ghost" onClick={closeOutreachModal}>Cancel</button>
                </div>
              </>
            )}

            {outreachModal.phase === 'generating' && (
              <div className="modal-generating">
                <div className="spinner spinner--sm" />
                Drafting outreach…
              </div>
            )}

            {outreachModal.phase === 'error' && (
              <p className="error" style={{ marginTop: 8 }}>Couldn't generate outreach. Try again.</p>
            )}

            {outreachModal.phase === 'done' && outreachModal.result && (
              <>
                <div className="outreach-field">
                  <div className="outreach-field-header">
                    <p className="sub-mode-label">Subject</p>
                    <button
                      className="btn-ghost btn-sm"
                      onClick={() => navigator.clipboard.writeText(outreachModal.result.subject)}
                    >Copy</button>
                  </div>
                  <p className="outreach-subject">{outreachModal.result.subject}</p>
                </div>
                <div className="outreach-field">
                  <div className="outreach-field-header">
                    <p className="sub-mode-label">Body</p>
                    <button
                      className="btn-ghost btn-sm"
                      onClick={() => navigator.clipboard.writeText(outreachModal.result.body)}
                    >Copy</button>
                  </div>
                  <p className="outreach-body">{outreachModal.result.body}</p>
                </div>
                <div className="modal-actions">
                  <button className="btn-ghost" onClick={handleGenerateOutreach}>Regenerate</button>
                  <button className="btn-ghost" onClick={closeOutreachModal}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Submission draft modal */}
      {subModal.open && (
        <div className="modal-overlay" onClick={closeSubModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Draft Submission</h2>
                <p className="modal-subtitle">{candidate.first_name} {candidate.last_name}</p>
              </div>
              <button className="modal-close" onClick={closeSubModal}>✕</button>
            </div>

            {/* Format toggle */}
            {(subModal.phase === 'pick' || subModal.phase === 'done') && (
              <div className="format-toggle">
                <button
                  className={`format-toggle-btn${subModal.format === 'email' ? ' format-toggle-btn--active' : ''}`}
                  onClick={() => setSubModal(prev => ({ ...prev, format: 'email' }))}
                >Email</button>
                <button
                  className={`format-toggle-btn${subModal.format === 'bullet' ? ' format-toggle-btn--active' : ''}`}
                  onClick={() => setSubModal(prev => ({ ...prev, format: 'bullet' }))}
                >Bullet</button>
              </div>
            )}

            {/* Pick phase — choose mode and role */}
            {subModal.phase === 'pick' && (
              <div className="sub-mode-picker">
                {pipelines.length > 0 && (
                  <div className="sub-mode-section">
                    <p className="sub-mode-label">JD Specific</p>
                    <p className="sub-mode-hint">Tailor the submission to a specific role's job description.</p>
                    <select
                      className="field-input"
                      value={subModal.roleId}
                      onChange={e => setSubModal(prev => ({ ...prev, roleId: e.target.value, mode: e.target.value ? 'jd' : null }))}
                    >
                      <option value="">Select a role…</option>
                      {pipelines.map(p => (
                        <option key={p.id} value={p.role_id ?? p.roles?.id}>
                          {p.roles?.title ?? 'Unknown role'}{p.roles?.clients?.name ? ` — ${p.roles.clients.name}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="sub-mode-section">
                  <p className="sub-mode-label">Generic</p>
                  <p className="sub-mode-hint">Write based on the candidate's record alone — no JD context.</p>
                  <button
                    className={`btn-ghost${subModal.mode === 'generic' ? ' btn-ghost--selected' : ''}`}
                    onClick={() => setSubModal(prev => ({ ...prev, mode: 'generic', roleId: '' }))}
                  >
                    Use Generic
                  </button>
                </div>
                <div className="modal-actions" style={{ marginTop: 8 }}>
                  <button
                    className="btn-primary"
                    onClick={handleSubGenerate}
                    disabled={!subModal.mode}
                  >
                    Generate
                  </button>
                  <button className="btn-ghost" onClick={closeSubModal}>Cancel</button>
                </div>
              </div>
            )}

            {subModal.phase === 'generating' && (
              <div className="modal-generating">
                <div className="spinner spinner--sm" />
                Drafting submission…
              </div>
            )}

            {subModal.phase === 'error' && (
              <p className="error" style={{ marginTop: 8 }}>Couldn't generate submission. Try again.</p>
            )}

            {subModal.phase === 'done' && (
              <>
                <textarea
                  ref={subTextareaRef}
                  className="submission-textarea"
                  value={subModal.text}
                  onChange={e => setSubModal(prev => ({ ...prev, text: e.target.value }))}
                  rows={12}
                />
                <div className="modal-actions">
                  <button
                    className="btn-primary"
                    onClick={handleSubSaveToQueue}
                    disabled={subSaving || subSaved}
                  >
                    {subSaved ? 'Saved ✓' : subSaving ? 'Saving…' : 'Save to Queue'}
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(subModal.text)
                      subTextareaRef.current?.select()
                    }}
                  >
                    Copy
                  </button>
                  <button className="btn-ghost" onClick={handleSubGenerate}>Regenerate</button>
                  <button className="btn-ghost" onClick={closeSubModal}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Expected comp modal — blocking on stage advance to interview+ */}
      {compModal.open && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Expected Comp</h2>
                <p className="modal-subtitle">Advancing to {compModal.nextStage}</p>
              </div>
            </div>
            <p className="sub-mode-hint" style={{ marginBottom: 16 }}>
              What's this candidate's expected comp for this role? Wren uses this to track your pipeline value. You can update it later if it changes.
            </p>
            <div className="comp-prompt-row">
              <span className="comp-prefix">$</span>
              <input
                type="number"
                className="field-input comp-prompt-input"
                placeholder="Annual base in dollars"
                value={compModal.comp}
                onChange={e => setCompModal(prev => ({ ...prev, comp: e.target.value }))}
                min="0"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleCompModalSave()}
              />
            </div>
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button
                className="btn-primary"
                onClick={handleCompModalSave}
                disabled={compModal.saving || !compModal.comp}
              >
                {compModal.saving ? 'Saving…' : 'Save and advance'}
              </button>
              <button
                className="btn-ghost"
                onClick={() => setCompModal({ open: false, entry: null, nextStage: '', comp: '', saving: false })}
              >
                Cancel stage advance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debrief modal */}
      {debriefModal.open && (
        <div className="modal-overlay" onClick={closeDebriefModal}>
          <div className="modal modal--debrief" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Debrief</h2>
                <p className="modal-subtitle">{candidate.first_name} {candidate.last_name}</p>
              </div>
              <button className="modal-close" onClick={closeDebriefModal}>✕</button>
            </div>

            {debriefModal.phase === 'input' && (
              <>
                <div className="debrief-input-grid">
                  <div className="debrief-input-row">
                    <label className="debrief-input-label">Outcome</label>
                    <select
                      className="log-select"
                      value={debriefModal.outcome}
                      onChange={e => setDebriefModal(prev => ({ ...prev, outcome: e.target.value }))}
                    >
                      <option value="neutral">Neutral</option>
                      <option value="advance">Advance</option>
                      <option value="hold">Hold</option>
                      <option value="reject">Reject</option>
                    </select>
                  </div>
                  {pipelines.length > 1 && (
                    <div className="debrief-input-row">
                      <label className="debrief-input-label">Role</label>
                      <select
                        className="log-select"
                        value={debriefModal.pipelineId}
                        onChange={e => setDebriefModal(prev => ({ ...prev, pipelineId: e.target.value }))}
                      >
                        <option value="">Select role…</option>
                        {pipelines.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.roles?.title ?? 'Unknown'}{p.roles?.clients?.name ? ` — ${p.roles.clients.name}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <textarea
                  className="debrief-raw-textarea"
                  placeholder="Paste transcript or brain dump — Zoom, Fathom, Granola, or typed notes…"
                  rows={10}
                  value={debriefModal.raw}
                  onChange={e => setDebriefModal(prev => ({ ...prev, raw: e.target.value }))}
                  autoFocus
                />
                <div className="modal-actions">
                  <button
                    className="btn-primary"
                    onClick={handleExtractDebrief}
                    disabled={!debriefModal.raw.trim()}
                  >
                    Extract signal
                  </button>
                  <button className="btn-ghost" onClick={closeDebriefModal}>Skip</button>
                </div>
              </>
            )}

            {debriefModal.phase === 'extracting' && (
              <div className="modal-generating">
                <div className="spinner spinner--sm" />
                Extracting signal…
              </div>
            )}

            {debriefModal.phase === 'error' && (
              <>
                <p className="error" style={{ marginTop: 8 }}>{debriefModal.error ?? 'Something went wrong.'}</p>
                <div className="modal-actions">
                  <button className="btn-ghost" onClick={() => setDebriefModal(prev => ({ ...prev, phase: 'input', error: null }))}>
                    Try again
                  </button>
                  <button className="btn-ghost" onClick={closeDebriefModal}>Close</button>
                </div>
              </>
            )}

            {(debriefModal.phase === 'review' || debriefModal.phase === 'saving') && debriefModal.extracted && (
              <>
                <div className="debrief-review">
                  <div className="debrief-review-field">
                    <label className="debrief-review-label">Summary</label>
                    <textarea
                      className="debrief-review-textarea"
                      rows={3}
                      value={debriefModal.reviewSummary}
                      onChange={e => setDebriefModal(prev => ({ ...prev, reviewSummary: e.target.value }))}
                    />
                  </div>
                  <div className="debrief-review-field">
                    <label className="debrief-review-label">Next action</label>
                    <textarea
                      className="debrief-review-textarea"
                      rows={2}
                      value={debriefModal.reviewNextAction}
                      onChange={e => setDebriefModal(prev => ({ ...prev, reviewNextAction: e.target.value }))}
                    />
                  </div>
                  {DEBRIEF_SIGNAL_CATS.map(cat => {
                    const items = debriefModal.extracted[cat.key]
                    if (!items?.length) return null
                    return (
                      <div key={cat.key} className="debrief-review-signals">
                        <span className={`debrief-signal-cat-label ${cat.cls}`}>{cat.label}</span>
                        <ul className="debrief-signal-list">
                          {items.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                      </div>
                    )
                  })}
                  {debriefModal.extracted.questions_to_ask_next?.length > 0 && (
                    <div className="debrief-review-signals">
                      <span className="debrief-signal-cat-label dsig--questions">Ask next</span>
                      <ul className="debrief-signal-list">
                        {debriefModal.extracted.questions_to_ask_next.map((q, i) => <li key={i}>{q}</li>)}
                      </ul>
                    </div>
                  )}
                  {debriefModal.extracted.updates_to_record?.length > 0 && (
                    <div className="debrief-review-signals">
                      <span className="debrief-signal-cat-label dsig--updates">Update record</span>
                      <ul className="debrief-signal-list debrief-signal-list--updates">
                        {debriefModal.extracted.updates_to_record.map((u, i) => <li key={i}>{u}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="debrief-confidence-row">
                  <label className="confidence-label">Your confidence after this call? (1–10)</label>
                  <input
                    type="number" min="1" max="10"
                    className="confidence-input"
                    placeholder="Optional"
                    value={debriefModal.confidence_post}
                    onChange={e => setDebriefModal(prev => ({ ...prev, confidence_post: e.target.value }))}
                  />
                </div>
                <div className="modal-actions">
                  <button
                    className="btn-primary"
                    onClick={handleSaveDebrief}
                    disabled={debriefModal.phase === 'saving'}
                  >
                    {debriefModal.phase === 'saving' ? 'Saving…' : 'Save debrief'}
                  </button>
                  <button className="btn-ghost" onClick={() => setDebriefModal(prev => ({ ...prev, phase: 'input' }))}>
                    Back
                  </button>
                  <button className="btn-ghost" onClick={closeDebriefModal}>Discard</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Interaction edit modal */}
      {editInteractionModal.open && editInteractionModal.interaction && (
        <InteractionEditModal
          modal={editInteractionModal}
          onSave={handleEditInteractionSave}
          onClose={() => setEditInteractionModal({ open: false, interaction: null, linkedDebriefId: null })}
        />
      )}

    </AppLayout>
  )
}
