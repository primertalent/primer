// Default chips per action_type when the agent loop doesn't supply suggestions.
const DEFAULT_CHIPS = {
  follow_up_overdue:  [{ label: 'Log interaction', action: 'log_interaction' }, { label: 'Draft check-in', action: 'draft_urgency_note' }],
  risk_flag:          [{ label: 'Log debrief', action: 'log_debrief' }],
  missing_data:       [{ label: 'Set comp', action: 'set_expected_comp' }, { label: 'Add fee', action: 'add_fee' }],
  opportunity:        [{ label: 'Draft submission', action: 'draft_submission' }],
  stage_check:        [{ label: 'Log interaction', action: 'log_interaction' }],
  relationship_warm:  [{ label: 'Log interaction', action: 'log_interaction' }],
  sharpening_ask:     [{ label: 'Log debrief', action: 'log_debrief' }],
  mcp_opportunity:    [{ label: 'Draft submission', action: 'draft_submission' }],
}

const URGENCY_LABEL = { now: 'Now', today: 'Today' }
const URGENCY_CLASS = { now: 'action-urgency--now', today: 'action-urgency--today' }

export default function ActionCard({ action, onDismiss, onSnooze, onChipClick }) {
  const chips = action.suggestions?.length
    ? action.suggestions
    : (DEFAULT_CHIPS[action.action_type] ?? [])

  const chipContext = {
    candidate_id: action.candidateId ?? null,
    pipeline_id:  action.pipelineId ?? null,
    role_id:      action.roleId ?? null,
  }

  const urgencyLabel = URGENCY_LABEL[action.urgency]
  const urgencyClass = action.ephemeral ? 'action-urgency--live' : (URGENCY_CLASS[action.urgency] ?? '')

  return (
    <div className={`action-card${action.ephemeral ? ' action-card--ephemeral' : ''}`}>
      <div className="action-card-header">
        <div className="action-card-meta">
          {urgencyLabel && (
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
          <button className="action-dismiss" onClick={onDismiss} aria-label="Dismiss">×</button>
        </div>
      </div>

      <p className="action-message">{action.why}</p>

      {action.suggested_next_step && (
        <p className="action-next">{action.suggested_next_step}</p>
      )}

      {chips.length > 0 && (
        <div className="action-chips">
          {chips.slice(0, 3).map((s, i) => (
            <button
              key={i}
              className={`action-chip${i === 0 ? ' action-chip--primary' : ''}`}
              onClick={() => onChipClick(s.action, { ...chipContext, ...(s.context ?? {}) })}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
