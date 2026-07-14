import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { composeBrief } from './_lib/composeBrief.js'
import { getOrCreateTodayConversation } from './_lib/getOrCreateTodayConversation.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const resend    = new Resend(process.env.RESEND_API_KEY)

export const config = { maxDuration: 60 }

// Returns the recruiter's local hour (0-23) from an IANA timezone string.
// Note: half-hour-offset timezones (Asia/Kolkata etc.) will never land on an
// even hour from an hourly cron. All US timezones are whole-hour offsets and
// are reliably served. Extend to per-minute cron if half-offset zones matter.
function localHour(tz) {
  return parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz || 'America/New_York',
      hour: 'numeric',
      hour12: false,
    }).format(new Date()),
    10
  )
}

function inlineHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

function buildBriefHtml(text, dateLabel) {
  const lines  = text.split('\n')
  const blocks = []
  let inList = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      if (inList) { blocks.push('</ul>'); inList = false }
      blocks.push('<div style="height:10px"></div>')
      continue
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const content = inlineHtml(line.slice(2))
      if (!inList) { blocks.push('<ul style="margin:0 0 8px 0;padding:0 0 0 18px;">'); inList = true }
      blocks.push(`<li style="margin:0 0 4px 0;line-height:1.6;">${content}</li>`)
      continue
    }
    if (inList) { blocks.push('</ul>'); inList = false }
    blocks.push(`<p style="margin:0 0 10px 0;line-height:1.6;">${inlineHtml(line)}</p>`)
  }
  if (inList) blocks.push('</ul>')

  const body = blocks.join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Wren: your brief for ${inlineHtml(dateLabel)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f4f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f4f1;">
<tr><td align="center" style="padding:32px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
  <tr>
    <td style="background-color:#1a1a1a;padding:18px 24px;border-radius:8px 8px 0 0;">
      <span style="color:#f5f4f1;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">Wren</span>
    </td>
  </tr>
  <tr>
    <td style="background-color:#ffffff;padding:24px 24px 12px;font-size:15px;color:#1a1a1a;border-left:1px solid #e8e8e5;border-right:1px solid #e8e8e5;">
      ${body}
    </td>
  </tr>
  <tr>
    <td style="background-color:#ffffff;padding:4px 24px 24px;border-left:1px solid #e8e8e5;border-right:1px solid #e8e8e5;">
      <a href="https://hirewren.com/wren" style="display:inline-block;background-color:#1a1a1a;color:#f5f4f1;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:500;">Open Wren</a>
    </td>
  </tr>
  <tr>
    <td style="background-color:#ffffff;padding:16px 24px 24px;border-top:1px solid #e8e8e5;border-left:1px solid #e8e8e5;border-right:1px solid #e8e8e5;border-radius:0 0 8px 8px;">
      <p style="margin:0;font-size:12px;color:#999999;line-height:1.5;">You're receiving this because Wren generates a daily brief for your recruiting desk. To turn off email delivery, reply "unsubscribe" or adjust your preferences in Wren settings.</p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

export default async function handler(req, res) {
  // CRON_SECRET is automatically provided by Vercel Pro for native cron invocations
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // ?dryRun=1 — runs full path (compose, HTML render, conversation attach) and logs
  // the email payload without calling Resend or stamping emailed_at.
  // Permanent test path: bypasses the 9am hour filter so it works any time.
  const dryRun = req.query.dryRun === '1'

  // ── All recruiters ───────────────────────────────────────────────────────
  // Model A: the brief always emails at 9am local — seeing it in-app does NOT
  // suppress the email. Generate-once-deliver-twice: composeBrief returns the
  // existing brief if one was already composed today (e.g. on app load), so the
  // inbox brief matches the in-app brief exactly. emailed_at is the only guard
  // against a duplicate send.
  // recruiters.email = login email, used for brief delivery.
  // If brief-delivery-email needs to differ from login-email in future,
  // add a brief_email column and prefer it here.
  const { data: recruiters, error: recErr } = await supabase
    .from('recruiters')
    .select('id, full_name, timezone, created_at, email')
  if (recErr) {
    console.error('[cron-brief] recruiters fetch failed:', recErr.message)
    return res.status(500).json({ error: 'Failed to fetch recruiters' })
  }

  const results = []

  for (const recruiter of (recruiters || [])) {
    const hour = localHour(recruiter.timezone)
    if (!dryRun && hour !== 9) {
      results.push({ id: recruiter.id, status: 'not_9am', local_hour: hour })
      continue
    }

    if (!recruiter.email) {
      results.push({ id: recruiter.id, status: 'no_email' })
      continue
    }

    try {
      // ── Resolve today's conversation (shared with the app compose path) ──
      // Same helper the in-app path uses, so the emailed brief and the in-app brief
      // always land in ONE conversation per recruiter per local day. Replaces the old
      // "newest conversation of any day" logic that diverged from the app's resolver.
      const conversationId = await getOrCreateTodayConversation(supabase, recruiter)

      // ── Compose brief ──────────────────────────────────────────────────
      const { message_id } = await composeBrief(supabase, anthropic, { recruiter, conversationId })

      // ── Check emailed_at before sending ───────────────────────────────
      // Guards against duplicate sends if two cron processes overlap at the same minute
      const { data: briefRow } = await supabase
        .from('conversation_messages')
        .select('id, content')
        .eq('id', message_id)
        .single()

      if (briefRow?.content?.emailed_at) {
        results.push({ id: recruiter.id, status: 'already_emailed' })
        continue
      }

      // ── Build email ────────────────────────────────────────────────────
      const tz = recruiter.timezone || 'America/New_York'
      const dateLabel = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, weekday: 'long', month: 'long', day: 'numeric',
      }).format(new Date())

      const briefText = briefRow?.content?.text || ''
      const emailHtml = buildBriefHtml(briefText, dateLabel)
      const subject   = `Wren: your brief for ${dateLabel}`

      if (dryRun) {
        console.log('[cron-brief] dryRun payload:', JSON.stringify({
          to:           recruiter.email,
          from:         'Wren <wren@hirewren.com>',
          subject,
          html_length:  emailHtml.length,
          brief_preview: briefText.slice(0, 200),
        }, null, 2))
        results.push({ id: recruiter.id, status: 'dry_run_ok' })
        continue
      }

      // ── Send via Resend ────────────────────────────────────────────────
      const { error: sendErr } = await resend.emails.send({
        from: 'Wren <wren@hirewren.com>',
        to:   recruiter.email,
        subject,
        html: emailHtml,
      })

      if (sendErr) {
        console.error(`[cron-brief] Resend failed for ${recruiter.id}:`, sendErr.message)
        results.push({ id: recruiter.id, status: 'send_failed', detail: sendErr.message })
        continue
      }

      // Stamp emailed_at immediately — per-recruiter, not batched at loop end.
      // A mid-run crash must not re-send a brief that already went out.
      await supabase
        .from('conversation_messages')
        .update({ content: { ...briefRow.content, emailed_at: new Date().toISOString() } })
        .eq('id', message_id)

      results.push({ id: recruiter.id, status: 'sent' })

    } catch (err) {
      console.error(`[cron-brief] error for recruiter ${recruiter.id}:`, err.message)
      results.push({ id: recruiter.id, status: 'error', detail: err.message })
    }
  }

  const summary = {
    run_at:      new Date().toISOString(),
    dry_run:     dryRun,
    total:       results.length,
    sent:        results.filter(r => r.status === 'sent').length,
    dry_run_ok:  results.filter(r => r.status === 'dry_run_ok').length,
    skipped:     results.filter(r => ['not_9am', 'no_email', 'already_emailed'].includes(r.status)).length,
    errors:      results.filter(r => r.status === 'error' || r.status === 'send_failed').length,
    results,
  }
  console.log('[cron-brief]', JSON.stringify(summary))
  return res.json(summary)
}
