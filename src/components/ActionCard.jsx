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
  new_inbound:        [{ label: 'Draft reply', action: 'draft_inbound_reply' }, { label: 'Add to a role', action: 'screen_against_role' }],
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

export default function ActionCard({ action, onDismiss, onSnooze, onComplete, onChipClick, onCardClick }) {
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

      {chips.length > 0 && (
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
      )}
    </div>
  )
}
