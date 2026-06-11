/*
 * api/gmail-send.js — Send email via recruiter's Gmail account
 *
 * Recruiter-initiated only. Never called by the agent loop.
 * Validates JWT → refreshes token if needed → sends via Gmail REST API →
 * marks draft sent → logs outbound interaction → sets pipeline.submitted_at
 * on first send only.
 *
 * Returns { success: true } or { error: 'auth_required' | 'google_token_revoked' | 'send_failed' | ... }
 * auth_required:        Gmail not connected at all — recruiter needs to run OAuth flow.
 * google_token_revoked: Access was revoked at Google — token cleared, reconnect needed.
 * send_failed:          Gmail API rejected the message — card stays, toast shows.
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Build an RFC 2822 message and base64url-encode it for the Gmail API.
function buildRaw({ from, to, subject, body }) {
  const msg = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
  ].join('\r\n')
  return Buffer.from(msg)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      grant_type:    'refresh_token',
    }),
  })
  return res.json()
}

// Wipe all three token columns — called when access is definitively revoked.
async function clearGmailTokens(supabase, recruiterId) {
  await supabase.from('recruiters').update({
    gmail_access_token:  null,
    gmail_refresh_token: null,
    gmail_token_expiry:  null,
  }).eq('id', recruiterId)
}

function doGmailSend(accessToken, raw) {
  return fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  })
}

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Validate Supabase session
  const jwt = req.headers.authorization?.replace('Bearer ', '').trim()
  if (!jwt) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt)
  if (userErr || !user) return res.status(401).json({ error: 'unauthorized' })

  const { data: recruiter, error: recErr } = await supabase
    .from('recruiters')
    .select('id, email, gmail_access_token, gmail_refresh_token, gmail_token_expiry')
    .eq('user_id', user.id)
    .single()

  if (recErr || !recruiter) return res.status(404).json({ error: 'recruiter_not_found' })

  // No Gmail tokens at all → recruiter needs to connect
  if (!recruiter.gmail_access_token) {
    return res.status(200).json({ error: 'auth_required' })
  }

  // Refresh if expired or within 60s of expiry
  let accessToken = recruiter.gmail_access_token
  const tokenExpiry = recruiter.gmail_token_expiry ? new Date(recruiter.gmail_token_expiry) : null
  const needsRefresh = !tokenExpiry || tokenExpiry < new Date(Date.now() + 60_000)
  let didRefresh = false

  if (needsRefresh) {
    if (!recruiter.gmail_refresh_token) return res.status(200).json({ error: 'auth_required' })

    const refreshed = await refreshAccessToken(recruiter.gmail_refresh_token)
    if (refreshed.error === 'invalid_grant') {
      // Definitively revoked — clear token row so the hint updates on next load.
      await clearGmailTokens(supabase, recruiter.id)
      return res.status(200).json({ error: 'google_token_revoked' })
    }
    if (refreshed.error) {
      console.warn('[gmail-send] token refresh failed:', refreshed.error)
      return res.status(200).json({ error: 'auth_required' })
    }

    accessToken = refreshed.access_token
    didRefresh = true
    const newExpiry = new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString()
    await supabase.from('recruiters').update({
      gmail_access_token: accessToken,
      gmail_token_expiry: newExpiry,
    }).eq('id', recruiter.id)
  }

  const { to, subject, body, draft_id, pipeline_id, candidate_id } = req.body
  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'missing_fields' })
  }

  // Send via Gmail REST API
  const raw = buildRaw({ from: recruiter.email, to, subject, body })
  let gmailRes = await doGmailSend(accessToken, raw)

  // 401 on send with a fresh (or still-valid) token: stale access token edge case.
  // Attempt one refresh before declaring revocation.
  if (gmailRes.status === 401 && !didRefresh) {
    if (!recruiter.gmail_refresh_token) {
      await clearGmailTokens(supabase, recruiter.id)
      return res.status(200).json({ error: 'google_token_revoked' })
    }
    const refreshed = await refreshAccessToken(recruiter.gmail_refresh_token)
    if (refreshed.error === 'invalid_grant') {
      await clearGmailTokens(supabase, recruiter.id)
      return res.status(200).json({ error: 'google_token_revoked' })
    }
    if (refreshed.error) {
      console.warn('[gmail-send] retry refresh failed:', refreshed.error)
      return res.status(200).json({ error: 'auth_required' })
    }
    accessToken = refreshed.access_token
    await supabase.from('recruiters').update({
      gmail_access_token: accessToken,
      gmail_token_expiry: new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString(),
    }).eq('id', recruiter.id)
    gmailRes = await doGmailSend(accessToken, raw)
  }

  if (!gmailRes.ok) {
    if (gmailRes.status === 401) {
      // Still 401 after refresh — definitively revoked.
      await clearGmailTokens(supabase, recruiter.id)
      return res.status(200).json({ error: 'google_token_revoked' })
    }
    const gmailErr = await gmailRes.json().catch(() => ({}))
    console.error('[gmail-send] Gmail API error:', gmailErr)
    return res.status(200).json({
      error:  'send_failed',
      detail: gmailErr.error?.message ?? 'unknown',
    })
  }

  const gmailMsg = await gmailRes.json()
  const now = new Date().toISOString()

  // Mark draft as sent
  if (draft_id) {
    await supabase.from('drafts')
      .update({ status: 'sent', sent_at: now })
      .eq('id', draft_id)
  }

  // Log outbound interaction on every send (first or re-send) for full audit trail
  if (candidate_id) {
    await supabase.from('interactions').insert({
      recruiter_id: recruiter.id,
      candidate_id,
      pipeline_id:  pipeline_id ?? null,
      type:         'email',
      direction:    'outbound',
      subject,
      body,
      occurred_at:  now,
      meta: { gmail_message_id: gmailMsg.id, sent_via: 'wren_gmail' },
    })
  }

  // Set pipeline.submitted_at only on first send — it anchors the client-side
  // deal clock. Re-sends don't reset it; the interaction log captures those.
  if (pipeline_id) {
    await supabase.from('pipelines')
      .update({ submitted_at: now })
      .eq('id', pipeline_id)
      .is('submitted_at', null)
  }

  return res.status(200).json({ success: true, gmail_id: gmailMsg.id })
}
