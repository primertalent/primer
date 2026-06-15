export const STAGES = ['submitted', 'first_round', 'middle_round', 'final_round', 'offer', 'placed', 'lost']

export const STAGE_LABELS = {
  submitted:    'Submitted',
  first_round:  'First Round',
  middle_round: 'Middle Round',
  final_round:  'Final Round',
  offer:        'Offer',
  placed:       'Placed',
  lost:         'Lost',
}

export const LOST_REASONS = [
  'rejected', 'withdrawn', 'counteroffer', 'lost_to_offer',
  'role_closed', 'fell_through', 'unresponsive', 'comp', 'other',
]

export const BACKWARD_REASONS = ['client_added_step', 'candidate_bumped', 'correction', 'other']

export const ACTIVE_STAGES = new Set(['submitted', 'first_round', 'middle_round', 'final_round', 'offer'])

export function classifyMove(currentStage, targetStage) {
  const terminals = new Set(['placed', 'lost'])
  if (terminals.has(targetStage))  return 'terminal'
  if (terminals.has(currentStage)) return 'reopen'
  const currentIdx = STAGES.indexOf(currentStage)
  const targetIdx  = STAGES.indexOf(targetStage)
  return targetIdx > currentIdx ? 'forward' : 'backward'
}

export function guaranteeStatus(startDate) {
  if (!startDate) return null
  const start = new Date(startDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.floor((today - start) / (1000 * 60 * 60 * 24))
  if (days < 0)   return 'pre_start'
  if (days <= 30) return '0-30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return 'cleared'
}
