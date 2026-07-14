/*
 * api/_lib/getOrCreateTodayConversation.js — the ONE resolver for "today's
 * conversation," shared by both brief callers so they can never diverge:
 *   - api/cron-brief.js       (the 9am email path)
 *   - api/compose-brief.js    (the in-app path — the app defers to the server now)
 *
 * Recruiter-scoped, today-filtered by the RECRUITER's timezone (not UTC, not the
 * viewer's browser tz), creates if absent. The brief is a per-local-day ritual sent
 * at 9am local, so "today" must mean the recruiter's local day. The divergence bug
 * came from the two callers disagreeing: cron used "newest conversation of any day"
 * and the app used browser-local midnight — so the 9am email and the in-app brief
 * landed in different conversations and each passed the (then conversation-scoped)
 * idempotency gate. One helper, one boundary, one conversation.
 */

// Offset (ms) between tz's wall clock and UTC at a given instant: (wall-as-UTC) - utc.
function tzOffsetMs(utcMs, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const p = {}
  for (const part of dtf.formatToParts(new Date(utcMs))) p[part.type] = part.value
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - utcMs
}

// UTC ISO instant of the recruiter's current local midnight (start of their day).
function localDayStartISO(tz) {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date()).split('-').map(Number)
  const naive = Date.UTC(y, m - 1, d, 0, 0, 0)
  const guess = naive - tzOffsetMs(naive, tz)
  return new Date(naive - tzOffsetMs(guess, tz)).toISOString()
}

// Returns the id of the recruiter's conversation for their current local day,
// creating one if none exists yet.
export async function getOrCreateTodayConversation(supabase, recruiter) {
  const tz = recruiter.timezone || 'America/New_York'
  const dayStart = localDayStartISO(tz)

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('recruiter_id', recruiter.id)
    .gte('created_at', dayStart)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) return existing.id

  const { data: created, error } = await supabase
    .from('conversations')
    .insert({ recruiter_id: recruiter.id })
    .select('id')
    .single()
  if (error) throw error
  return created.id
}
