/*
 * api/_lib/googleToken.js — shared Google OAuth access-token accessor (read paths).
 *
 * Returns a valid (refreshed if needed) access token for a recruiter's stored Google
 * credentials, persisting a refreshed access token + expiry back to the recruiters
 * row. This mirrors the refresh contract gmail-send.js implements inline for the send
 * path.
 *
 * gmail-send.js is intentionally NOT refactored onto this helper in this session —
 * the verified production send path stays byte-for-byte unchanged. See the pointer
 * comment there. Read-only consumers (list_calendar) use this instead of duplicating
 * refresh logic.
 *
 * Does NOT clear tokens on revocation — the send path owns token-clearing
 * (clearGmailTokens) so a read failure never wipes the shared send credentials.
 *
 * Returns { accessToken } on success, or { error } where error is one of:
 *   'not_connected'  — no access/refresh token stored (never connected)
 *   'token_revoked'  — refresh returned invalid_grant (access revoked at Google)
 *   'refresh_failed' — transient refresh failure
 */

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

// Fresh access token for the recruiter, refreshing + persisting if the stored one is
// expired or within 60s of expiry (same 60s guard as gmail-send.js). Only ever writes
// the refreshed access token + expiry.
export async function getFreshAccessToken(supabase, recruiterId) {
  const { data: rec, error } = await supabase
    .from('recruiters')
    .select('gmail_access_token, gmail_refresh_token, gmail_token_expiry')
    .eq('id', recruiterId)
    .single()

  if (error || !rec || !rec.gmail_access_token) return { error: 'not_connected' }

  const expiry = rec.gmail_token_expiry ? new Date(rec.gmail_token_expiry) : null
  const needsRefresh = !expiry || expiry < new Date(Date.now() + 60_000)
  if (!needsRefresh) return { accessToken: rec.gmail_access_token }

  if (!rec.gmail_refresh_token) return { error: 'not_connected' }

  const refreshed = await refreshAccessToken(rec.gmail_refresh_token)
  if (refreshed.error === 'invalid_grant') return { error: 'token_revoked' }
  if (refreshed.error || !refreshed.access_token) return { error: 'refresh_failed' }

  const newExpiry = new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString()
  await supabase.from('recruiters').update({
    gmail_access_token: refreshed.access_token,
    gmail_token_expiry: newExpiry,
  }).eq('id', recruiterId)

  return { accessToken: refreshed.access_token }
}
