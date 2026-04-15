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
import { urgencyClass } from '../lib/urgency'

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

function InteractionEntry({ interaction, onDelete }) {
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
    <div className="interaction-entry">
      <div className="interaction-meta">
        <span className="interaction-type">{TYPE_LABELS[interaction.type] ?? interaction.type}</span>
        {interaction.direction && (
          <span className="interaction-direction">{interaction.direction}</span>
        )}
        <span className="interaction-date">{formatDateShort(interaction.occurred_at)}</span>
        <button className="btn-row-remove" onClick={() => setConfirm(true)} title="Delete">×</button>
      </div>
      {interaction.subject && (
        <p className="interaction-subject">{interaction.subject}</p>
      )}
      {interaction.body && (
        <p className="interaction-body">{interaction.body}</p>
      )}
      {confirm && (
        <div className="inline-confirm">
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
  const [logForm, setLogForm] = useState({ type: 'call', direction: 'outbound', occurred_at: '', body: '' })
  const [logSaving, setLogSaving] = useState(false)
  const [logError, setLogError] = useState(null)

  // Delete
  const [deleting, setDeleting] = useState(false)

  // Career timeline
  const [timeline, setTimeline] = useState(null)
  const [signals, setSignals] = useState(null)
  const [parsingCareer, setParsingCareer] = useState(false)
  const [careerError, setCareerError] = useState(null)
  const [clearCareerConfirm, setClearCareerConfirm] = useState(false)
  const [clearingCareer, setClearingCareer] = useState(false)

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
      // Log auth state and recruiter context for debugging
      const { data: { user: authUser } } = await supabase.auth.getUser()
      console.debug('[CandidateCard] auth user id:', authUser?.id)
      console.debug('[CandidateCard] recruiter row:', recruiter)
      console.debug('[CandidateCard] fetching candidate id:', id)

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
      ])
      const [candidateRes, pipelineRes, interactionRes, rolesRes, screenerHistoryRes] = settled.map(r =>
        r.status === 'fulfilled' ? r.value : { data: null, error: { message: 'Request failed' } }
      )

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
        setSavedNextAction(c.enrichment_data?.next_action ?? null)
        setPipelines(pipelineRes.data ?? [])
        setInteractions(interactionRes.data ?? [])
        setOpenRoles(rolesRes.data ?? [])
        setScreenerHistory(screenerHistoryRes.data ?? [])

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

  async function handleAdvanceStage(entry) {
    const currentIdx = PIPELINE_STAGES.indexOf(entry.current_stage?.toLowerCase())
    if (currentIdx < 0 || currentIdx >= PIPELINE_STAGES.length - 1) return
    const nextStage = PIPELINE_STAGES[currentIdx + 1]
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

  function handleLogOpen() {
    const today = new Date().toISOString().slice(0, 16) // "YYYY-MM-DDTHH:MM"
    setLogForm({ type: 'call', direction: 'outbound', occurred_at: today, body: '' })
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
    }
    setLogSaving(false)
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
          <button className="btn-ghost" onClick={() => navigate('/candidates')}>Back to Candidates</button>
        </div>
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
            <button className="btn-ghost" onClick={openSubModal}>
              Draft Submission
            </button>
            <button
              className="btn-primary"
              onClick={handleGenerateNextAction}
              disabled={generating}
            >
              {generating ? 'Generating…' : 'Next Action'}
            </button>
            <button className="btn-ghost" onClick={openOutreachModal}>
              Outreach
            </button>
            <button className="btn-ghost" onClick={openLinkedinModal}>
              LinkedIn
            </button>
            <Link className="btn-ghost" to={`/candidates/${id}/edit`}>Edit</Link>
            <Link className="btn-ghost" to={`/candidates/${id}/call`}>Call Mode</Link>
            <button className="btn-ghost btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>

        {/* Signal badges */}
        {signals?.length > 0 && <SignalBadges signals={signals} />}

        {/* Saved next action (recruiter-owned) */}
        {savedNextAction && !nextActionEditing && (
          <div className="ai-card" style={{ borderColor: 'var(--color-primary)', borderWidth: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p className="ai-card-eyebrow">Next Action</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-ghost btn-sm" onClick={() => { setNextActionDraft(savedNextAction); setNextActionEditing(true) }}>Edit</button>
                <button className="btn-ghost btn-sm" onClick={handleGenerateNextAction} disabled={generating}>
                  {generating ? 'Thinking…' : 'Regenerate'}
                </button>
              </div>
            </div>
            <p className="ai-card-body">{savedNextAction}</p>
          </div>
        )}

        {/* Next action edit form */}
        {nextActionEditing && (
          <div className="ai-card">
            <p className="ai-card-eyebrow">Next Action</p>
            <textarea
              className="sub-draft-textarea"
              rows={2}
              style={{ marginTop: 8 }}
              value={nextActionDraft}
              onChange={e => setNextActionDraft(e.target.value)}
              placeholder="What needs to happen next with this candidate?"
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                className="btn-primary btn-sm"
                disabled={nextActionSaving}
                onClick={async () => {
                  setNextActionSaving(true)
                  const text = nextActionDraft.trim() || null
                  const { error } = await supabase.from('candidates').update({
                    enrichment_data: { ...(candidate.enrichment_data ?? {}), next_action: text },
                  }).eq('id', candidate.id)
                  if (!error) {
                    setSavedNextAction(text)
                    setNextActionEditing(false)
                  }
                  setNextActionSaving(false)
                }}
              >
                {nextActionSaving ? 'Saving…' : 'Save'}
              </button>
              <button className="btn-ghost btn-sm" onClick={() => setNextActionEditing(false)}>Cancel</button>
              {savedNextAction && (
                <button
                  className="btn-ghost btn-sm"
                  style={{ marginLeft: 'auto' }}
                  onClick={async () => {
                    await supabase.from('candidates').update({
                      enrichment_data: { ...(candidate.enrichment_data ?? {}), next_action: null },
                    }).eq('id', candidate.id)
                    setSavedNextAction(null)
                    setNextActionEditing(false)
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* AI suggestion */}
        {(generating || suggestion || genError) && !savedNextAction && (
          <div className={`ai-card ${genError ? 'ai-card--error' : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p className="ai-card-eyebrow">
                {genError ? 'Error' : 'Suggested Next Action'}
              </p>
              {!generating && !genError && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn-ghost btn-sm"
                    onClick={async () => {
                      setNextActionDraft(suggestion)
                      setNextActionSaving(true)
                      const { error } = await supabase.from('candidates').update({
                        enrichment_data: { ...(candidate.enrichment_data ?? {}), next_action: suggestion },
                      }).eq('id', candidate.id)
                      if (!error) setSavedNextAction(suggestion)
                      setNextActionSaving(false)
                    }}
                  >
                    Set as my action
                  </button>
                  <button className="btn-ghost btn-sm" onClick={handleGenerateNextAction}>Regenerate</button>
                </div>
              )}
            </div>
            {generating
              ? <div className="modal-generating"><div className="spinner spinner--sm" />Thinking…</div>
              : <p className="ai-card-body">{genError ? 'Couldn\'t generate a suggestion. Try again.' : suggestion}</p>
            }
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

            {pipelines.length === 0 && !pickerOpen ? (
              <p className="muted" style={{ marginTop: 8 }}>Not in any pipeline yet. Use + Add to Role to place this candidate.</p>
            ) : (
              pipelines.map(entry => (
                <PipelineEntry
                  key={entry.id}
                  entry={entry}
                  onAdvance={handleAdvanceStage}
                  advancing={advancingId === entry.id}
                  onRemove={handleRemovePipeline}
                />
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
                setPitchText(null)
                setPitchError(null)
                setScorecard(null)
                setScorecardError(null)
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
            {pipelines.length > 0 && (
              <button
                className="btn-ghost"
                onClick={handleGeneratePitch}
                disabled={!screenerRoleId || pitchGenerating}
              >
                {pitchGenerating ? 'Generating…' : 'Generate Pitch'}
              </button>
            )}
          </div>

          {screening && (
            <div className="modal-generating" style={{ marginTop: 12 }}>
              <div className="spinner spinner--sm" />
              Screening against role…
            </div>
          )}

          {screenError && (
            <div className="ai-card ai-card--error" style={{ marginTop: 16 }}>
              <p className="ai-card-eyebrow">Error</p>
              <p className="ai-card-body">Couldn't screen this candidate. Try again.</p>
            </div>
          )}

          {screenResult && <ScreenerResult result={screenResult} />}

          {/* Full Scorecard — only when cv_text exists and candidate is in pipeline for selected role */}
          {candidate.cv_text && screenerRoleId && pipelines.some(p => p.role_id === screenerRoleId) && (
            <div style={{ marginTop: 16 }}>
              <button
                className="btn-ghost"
                onClick={handleGenerateScorecard}
                disabled={scorecardGenerating}
              >
                {scorecardGenerating ? 'Generating…' : scorecard ? 'Regenerate Scorecard' : 'Full Scorecard'}
              </button>
            </div>
          )}

          {scorecardGenerating && (
            <div className="modal-generating" style={{ marginTop: 12 }}>
              <div className="spinner spinner--sm" />
              Building scorecard…
            </div>
          )}

          {scorecardError && (
            <div className="ai-card ai-card--error" style={{ marginTop: 16 }}>
              <p className="ai-card-eyebrow">Error</p>
              <p className="ai-card-body">Couldn't generate scorecard. Try again.</p>
            </div>
          )}

          {scorecard && <ScorecardResult result={scorecard} />}

          {pitchGenerating && (
            <div className="modal-generating" style={{ marginTop: 12 }}>
              <div className="spinner spinner--sm" />
              Generating pitch…
            </div>
          )}

          {pitchError && (
            <div className="ai-card ai-card--error" style={{ marginTop: 16 }}>
              <p className="ai-card-eyebrow">Error</p>
              <p className="ai-card-body">Couldn't generate pitch. Try again.</p>
            </div>
          )}

          {pitchText && (
            <div className="pitch-result" style={{ marginTop: 16 }}>
              <div className="pitch-result-header">
                <p className="screener-block-label">Candidate Pitch</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => navigator.clipboard.writeText(pitchText)}
                  >
                    Copy
                  </button>
                  <button
                    className="btn-ghost btn-sm"
                    onClick={handleSavePitch}
                    disabled={pitchSaving || pitchSaved}
                  >
                    {pitchSaving ? 'Saving…' : pitchSaved ? 'Saved ✓' : 'Save Pitch'}
                  </button>
                </div>
              </div>
              <p className="pitch-body">{pitchText}</p>
            </div>
          )}
        </section>

        {/* Career Timeline */}
        <section className="candidate-section" style={{ marginTop: 24 }}>
          <div className="section-heading-row">
            <h2 className="section-heading">Career Timeline</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {candidate.cv_text && (
                <button
                  className="btn-ghost btn-sm"
                  onClick={handleParseCareer}
                  disabled={parsingCareer}
                >
                  {parsingCareer ? 'Parsing…' : timeline ? 'Reparse' : 'Parse from CV'}
                </button>
              )}
              {timeline && !clearCareerConfirm && (
                <button className="btn-ghost btn-sm" onClick={() => setClearCareerConfirm(true)}>
                  Clear
                </button>
              )}
            </div>
          </div>
          {clearCareerConfirm && (
            <div className="inline-confirm">
              <span>Clear career data?</span>
              <button className="btn-confirm-yes" onClick={handleClearCareer} disabled={clearingCareer}>
                {clearingCareer ? 'Clearing…' : 'Yes, clear'}
              </button>
              <button className="btn-confirm-cancel" onClick={() => setClearCareerConfirm(false)}>Cancel</button>
            </div>
          )}
          {parsingCareer && (
            <div className="modal-generating" style={{ marginTop: 8 }}>
              <div className="spinner spinner--sm" />
              Parsing career history…
            </div>
          )}

          {careerError && (
            <div className="ai-card ai-card--error" style={{ marginTop: 8 }}>
              <p className="ai-card-eyebrow">Error</p>
              <p className="ai-card-body">Couldn't parse career history. Try again.</p>
            </div>
          )}

          {!candidate.cv_text && <p className="muted" style={{ marginTop: 8 }}>No CV on file. Upload a resume to enable career parsing.</p>}
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

        {/* Scores History — sourced from screener_results, not pipeline */}
        <section className="candidate-section" style={{ marginTop: 24 }}>
          <h2 className="section-heading">Scores History</h2>
          {screenerHistory.length === 0 ? (
            <p className="muted" style={{ marginTop: 4 }}>No screener results yet. Run the screener against a role to build history.</p>
          ) : (
            <div className="scores-history">
              {screenerHistory.map(sr => (
                <ScoreHistoryRow
                  key={sr.id}
                  sr={sr}
                  inPipeline={pipelines.some(p => p.role_id === sr.role_id)}
                  onDelete={handleDeleteScreenerResult}
                />
              ))}
            </div>
          )}
        </section>

        {/* Interaction history */}
        <section className="candidate-section" style={{ marginTop: 24 }}>
          <div className="section-heading-row">
            <h2 className="section-heading">Interactions</h2>
            {!logOpen && (
              <button className="btn-ghost btn-sm" onClick={handleLogOpen}>+ Log</button>
            )}
          </div>

          {logOpen && (
            <div className="log-form">
              <div className="log-form-row">
                <select
                  className="log-select"
                  value={logForm.type}
                  onChange={e => setLogForm(f => ({ ...f, type: e.target.value }))}
                >
                  <option value="call">Call</option>
                  <option value="email">Email</option>
                  <option value="note">Note</option>
                </select>
                {logForm.type !== 'note' && (
                  <select
                    className="log-select"
                    value={logForm.direction}
                    onChange={e => setLogForm(f => ({ ...f, direction: e.target.value }))}
                  >
                    <option value="outbound">Outbound</option>
                    <option value="inbound">Inbound</option>
                  </select>
                )}
                <input
                  type="datetime-local"
                  className="log-date"
                  value={logForm.occurred_at}
                  onChange={e => setLogForm(f => ({ ...f, occurred_at: e.target.value }))}
                />
              </div>
              <textarea
                className="log-textarea"
                placeholder="Notes…"
                rows={3}
                value={logForm.body}
                onChange={e => setLogForm(f => ({ ...f, body: e.target.value }))}
              />
              {logError && <p className="error" style={{ marginTop: 4 }}>{logError}</p>}
              <div className="log-form-actions">
                <button className="btn-primary btn-sm" onClick={handleLogSave} disabled={logSaving}>
                  {logSaving ? 'Saving…' : 'Save'}
                </button>
                <button className="btn-ghost btn-sm" onClick={() => setLogOpen(false)}>Cancel</button>
              </div>
            </div>
          )}

          {interactions.length === 0 ? (
            <p className="muted" style={{ marginTop: logOpen ? 16 : 4 }}>No interactions logged yet. Use + Log to record a call, email, or note.</p>
          ) : (
            <div className="interaction-feed" style={{ marginTop: logOpen ? 16 : 0 }}>
              {interactions.map(i => (
                <InteractionEntry key={i.id} interaction={i} onDelete={handleDeleteInteraction} />
              ))}
            </div>
          )}
        </section>

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

    </AppLayout>
  )
}
