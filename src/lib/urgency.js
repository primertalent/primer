/**
 * Returns a CSS modifier class for a next_action_due_at date.
 * null → no indicator
 * past → 'urgency--overdue'   (red)
 * today → 'urgency--today'    (yellow)
 * future → 'urgency--upcoming' (gray)
 */
export function urgencyClass(isoDate) {
  if (!isoDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(isoDate)
  due.setHours(0, 0, 0, 0)
  if (due < today) return 'urgency--overdue'
  if (due.getTime() === today.getTime()) return 'urgency--today'
  return 'urgency--upcoming'
}

/**
 * Given an array of pipeline entries, returns the urgencyClass for the
 * most pressing due date among active entries.
 * Priority: overdue > today > upcoming > null
 */
export function highestUrgencyClass(pipelineEntries) {
  const active = (pipelineEntries ?? []).filter(p => p.status === 'active' && p.next_action_due_at)
  if (!active.length) return null
  const ranked = { 'urgency--overdue': 3, 'urgency--today': 2, 'urgency--upcoming': 1 }
  let best = null
  for (const entry of active) {
    const cls = urgencyClass(entry.next_action_due_at)
    if (cls && (!best || ranked[cls] > ranked[best])) best = cls
  }
  return best
}
