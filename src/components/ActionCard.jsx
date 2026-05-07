import { useEffect, useState } from 'react'

// Default chips per action_type when the agent loop doesn't supply suggestions.
const DEFAULT_CHIPS = {
  follow_up_overdue:  [{ label: 'Log interaction', action: 'log_interaction' }, { label: 'Draft check-in', action: 'draft_urgency_note' }],
  risk_flag:          [{ label: 'Log debrief', action: 'log_debrief' }],
  missing_data:       [{ label: 'Set comp', action: 'set_expected_comp' }],
  opportunity:        [{ label: 'Draft submission', action: 'draft_submission' }],
  stage_check:        [{ label: 'Log interaction', action: 'log_interaction' }],
  relationship_warm:  [{ label: 'Log interaction', action: 'log_interaction' }],
  sharpening_ask:     [{ label: 'Log debrief', action: 'log_debrief' }],
  mcp_opportunity:    [{ label: 'Draft submission', action: 'draft_submission' }],
  new_inbound:          [{ label: 'Draft reply', action: 'draft_inbound_reply' }, { label: 'Add to a role', action: 'screen_against_role' }],
  notes_pending_match:  [{ label: 'Match candidate', action: 'match_candidate' }],
  intake_notes_ready:   [], // rendered via custom block — not chip row
  submittal_draft_ready: [], // rendered via custom block — not chip row
}

// build_search_strings auto-fires on role creation — never show as a manual chip.
// Role-only actions require a role_id; candidate-only actions require a candidate_id.
const ROLE_ONLY_ACTIONS = new Set(['add_fee', 'build_search_strings'])
const CANDIDATE_ONLY_ACTIONS = new Set([
  'log_debrief', 'log_interaction', 'set_expected_comp', 'draft_submission',
  'draft_outreach', 'queue_follow_up', 'draft_urgency_note',
  'prep_for_interview', 'prep_call', 'screen_against_role',
  'draft_inbound_reply',
])

const URGENCY_LABEL = { now: 'Now', today: 'Today' }
const URGENCY_CLASS = { now: 'action-urgency--now', today: 'action-urgency--today' }

// Parses Gemini Notes body into header/body segments for inline display.
// Falls back to a single prose block if fewer than 2 headers are detected.
// Header heuristic: single line, ≤60 chars, no sentence-ending punctuation, no bullet prefix.
function renderNotesSections(body) {
  if (!body) return null
  const blocks = body.split(/\n\n+/).map(b => b.trim()).filter(Boolean)
  const sections = blocks.map(block => ({
    isHeader: !block.includes('\n') && block.length <= 60 &&
      !/[.!?,]$/.test(block) && !/^[-*•\d]/.test(block),
    text: block,
  }))
  if (sections.filter(s => s.isHeader).length < 2) {
    return <p className="notes-section-body">{body.trim()}</p>
  }
  return sections.map((s, i) =>
    s.isHeader
      ? <p key={i} className="notes-section-header">{s.text}</p>
      : <p key={i} className="notes-section-body">{s.text}</p>
  )
}

export default function ActionCard({ action, onDismiss, onSnooze, onComplete, onChipClick, onCardClick }) {
  // intake_notes_ready state
  const [notesExpanded,      setNotesExpanded]      = useState(false)
  const [isGenerating,       setIsGenerating]        = useState(false)
  const [showGeneratingHint, setShowGeneratingHint]  = useState(false)
  // submittal_draft_ready state
  const [reviewExpanded, setReviewExpanded] = useState(false)
  const [draftText,      setDraftText]      = useState(() => action.context?.draft_text ?? '')

  // When action transitions to submittal_draft_ready (via trigger_submittal_draft handler),
  // populate textarea with generated text and clear the generating loading state.
  useEffect(() => {
    if (action.action_type === 'submittal_draft_ready' && action.context?.draft_text) {
      setDraftText(action.context.draft_text)
      setIsGenerating(false)
    }
  }, [action.action_type, action.context?.draft_text])

  // _generationFailed: transient UI-only flag set on the persistedActions card object by
  // Desk.jsx's trigger_submittal_draft error handler. Underscore prefix signals it is not
  // a DB field — it lives only in React state and is never written to Supabase.
  useEffect(() => {
    if (action._generationFailed === true) setIsGenerating(false)
  }, [action._generationFailed])

  // Secondary hint: "Drafting your submittal…" appears after 8s of generating state
  useEffect(() => {
    if (!isGenerating) { setShowGeneratingHint(false); return }
    const t = setTimeout(() => setShowGeneratingHint(true), 8000)
    return () => clearTimeout(t)
  }, [isGenerating])

  const rawChips = action.suggestions?.length
    ? action.suggestions
    : (DEFAULT_CHIPS[action.action_type] ?? [])

  const chipContext = {
    candidate_id: action.candidateId ?? null,
    pipeline_id:  action.pipelineId ?? null,
    role_id:      action.roleId ?? null,
  }

  // Suppress build_search_strings (auto-fires on role creation).
  // Drop role-only chips when no role_id, candidate-only chips when no candidate_id.
  const chips = rawChips.filter(chip => {
    if (chip.action === 'build_search_strings') return false
    if (ROLE_ONLY_ACTIONS.has(chip.action) && !chipContext.role_id) return false
    if (CANDIDATE_ONLY_ACTIONS.has(chip.action) && !chipContext.candidate_id) return false
    return true
  })

  const urgencyLabel = URGENCY_LABEL[action.urgency]
  const urgencyClass = action.ephemeral ? 'action-urgency--live' : (URGENCY_CLASS[action.urgency] ?? '')

  return (
    <div
      className={`action-card${action.ephemeral ? ' action-card--ephemeral' : ''}${onCardClick ? ' action-card--clickable' : ''}`}
      onClick={onCardClick}
    >
      <div className="action-card-header" onClick={e => e.stopPropagation()}>
        <div className="action-card-meta">
          {action.ephemeral && urgencyLabel && (
            <span className={`action-urgency ${urgencyClass}`}>{urgencyLabel}</span>
          )}
          {action.entityName && (
            <span className="action-entity">{action.entityName}</span>
          )}
          {action.entitySubtitle && (
            <span className="action-entity-sub">{action.entitySubtitle}</span>
          )}
        </div>
        <div className="action-card-controls">
          {onSnooze && (
            <button className="action-snooze" onClick={onSnooze} title="Snooze 24 hours">
              snooze
            </button>
          )}
          {onComplete && (
            <button className="action-complete" onClick={onComplete} title="Mark complete">
              done
            </button>
          )}
          <button className="action-dismiss" onClick={onDismiss} aria-label="Dismiss">×</button>
        </div>
      </div>

      <p className="action-message">{action.why}</p>

      {action.suggested_next_step && (
        <p className="action-next">{action.suggested_next_step}</p>
      )}


      {/* ── intake_notes_ready: inline notes expansion + explicit draft trigger ── */}
      {action.action_type === 'intake_notes_ready' ? (
        <div className="action-notes" onClick={e => e.stopPropagation()}>
          {notesExpanded ? (
            <div className="action-notes-body">
              {renderNotesSections(action.context?.notes_body)}
              {/* "Collapse" — DESIGN: border-radius 0, --bg bg, --hair border, --ink text, no icon */}
              <button className="action-draft-btn action-notes-collapse"
                onClick={() => setNotesExpanded(false)}>
                Collapse
              </button>
            </div>
          ) : (
            <div className="action-draft-controls">
              {/* "Read notes" primary — DESIGN: --ink bg, --ink-inverse text, border-radius 0 */}
              <button className="action-draft-btn action-draft-btn--primary"
                onClick={() => setNotesExpanded(true)}>
                Read notes
              </button>
              {action.context?.pipeline_id ? (
                isGenerating ? (
                  /* Generating state — DESIGN: disabled opacity, no --win, no icon */
                  <div className="action-generating">
                    <button className="action-draft-btn" disabled>Generating…</button>
                    {showGeneratingHint && (
                      <p className="action-generating-hint">
                        Drafting your submittal. This usually takes 10–15 seconds.
                      </p>
                    )}
                  </div>
                ) : (
                  /* "Draft submittal" — DESIGN: --bg bg, --hair border, --ink text, border-radius 0 */
                  <button className="action-draft-btn"
                    onClick={() => {
                      setIsGenerating(true)
                      onChipClick('trigger_submittal_draft', {
                        action_id:       action.id,
                        candidate_id:    action.context?.candidate_id,
                        pipeline_id:     action.context?.pipeline_id,
                        role_id:         action.context?.role_id,
                        interaction_id:  action.context?.interaction_id,
                        notes_body:      action.context?.notes_body,
                        candidate_name:  action.context?.candidate_name,
                        current_context: action.context,
                      })
                    }}>
                    Draft submittal
                  </button>
                )
              ) : (
                /* No pipeline — offer role attachment instead */
                <button className="action-draft-btn"
                  onClick={() => onChipClick('screen_against_role', {
                    candidate_id: action.context?.candidate_id,
                  })}>
                  Add to a role
                </button>
              )}
              {/* "Discard" — calls onComplete to mark acted_on_at; no draft to update */}
              <button className="action-draft-btn" onClick={onComplete}>Discard</button>
            </div>
          )}
        </div>

      /* ── submittal_draft_ready: review / approve / edit / discard ── */
      ) : action.action_type === 'submittal_draft_ready' ? (
        <div className="action-draft" onClick={e => e.stopPropagation()}>
          {reviewExpanded ? (
            <div className="action-draft-expanded">
              {/* Textarea — DESIGN: Fraunces prose, border-radius 0, --hair border,
                  focus: border 2px solid --ink (no box-shadow), no --win anywhere */}
              <textarea
                className="action-draft-textarea"
                value={draftText}
                onChange={e => setDraftText(e.target.value)}
                rows={10}
              />
              <div className="action-draft-buttons">
                {/* "Approve & copy" — DESIGN: --ink bg (primary), border-radius 0, NO --win */}
                <button className="action-draft-btn action-draft-btn--primary"
                  onClick={() => {
                    navigator.clipboard.writeText(draftText)
                    onChipClick('approve_submittal', {
                      draft_id:        action.context?.draft_id,
                      content:         draftText,
                      action_id:       action.id,
                      current_context: action.context,
                    })
                  }}>
                  Approve &amp; copy
                </button>
                <button className="action-draft-btn"
                  onClick={() => onChipClick('save_submittal_edits', {
                    draft_id:        action.context?.draft_id,
                    content:         draftText,
                    action_id:       action.id,
                    current_context: action.context,
                  })}>
                  Save edits
                </button>
                <button className="action-draft-btn"
                  onClick={() => setReviewExpanded(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Preview — DESIGN: Fraunces prose, --mute color */}
              {draftText && (
                <p className="action-draft-preview">
                  {draftText.slice(0, 200)}{draftText.length > 200 ? '…' : ''}
                </p>
              )}
              <div className="action-draft-controls">
                <button className="action-draft-btn action-draft-btn--primary"
                  onClick={() => setReviewExpanded(true)}>
                  Review
                </button>
                <button className="action-draft-btn"
                  onClick={() => onChipClick('discard_submittal', {
                    draft_id:  action.context?.draft_id,
                    action_id: action.id,
                  })}>
                  Discard
                </button>
              </div>
            </>
          )}
        </div>

      /* ── all other action types: standard chip row ── */
      ) : chips.length > 0 ? (
        <div className="action-chips" onClick={e => e.stopPropagation()}>
          {chips.slice(0, 3).map((s, i) => (
            <button
              key={i}
              className={`action-chip${i === 0 ? ' action-chip--primary' : ''}`}
              onClick={() => onChipClick(s.action, { ...(s.context ?? {}), ...chipContext })}
            >
              {s.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
