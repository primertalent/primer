/*
 * api/google-auth.js — Google OAuth token exchange for Gmail send
 *
 * Called by GoogleAuthCallback.jsx after Google redirects back with ?code=.
 * Validates the Supabase JWT, exchanges the authorization code for tokens,
 * and stores them on the recruiter row.
 *
 * Scope requested: https://www.googleapis.com/auth/gmail.send
 *
 * GET /api/google-auth?code=CODE&redirect_uri=URI
 * Headers: Authorization: Bearer <supabase_access_token>
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  const { code, redirect_uri } = req.query

  if (!code) return res.status(400).json({ error: 'missing_code' })

  // Validate caller's Supabase session
  const jwt = req.headers.authorization?.replace('Bearer ', '').trim()
  if (!jwt) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt)
  if (userErr || !user) return res.status(401).json({ error: 'unauthorized' })

  // Resolve redirect_uri: caller passes it explicitly so it matches what was
  // used during OAuth initiation. Fall back to inferring from origin header.
  const resolvedRedirectUri =
    redirect_uri ||
    (req.headers.origin ? `${req.headers.origin}/auth/google/callback` : null)

  if (!resolvedRedirectUri) {
    return res.status(400).json({ error: 'missing_redirect_uri' })
  }

  // Exchange authorization code for access + refresh tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri:  resolvedRedirectUri,
      grant_type:    'authorization_code',
    }),
  })

  const tokens = await tokenRes.json()
  if (tokens.error) {
    console.error('[google-auth] token exchange failed:', tokens.error, tokens.error_description)
    return res.status(400).json({ error: tokens.error, description: tokens.error_description ?? null })
  }

  const expiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString()

  const { error: updateErr } = await supabase
    .from('recruiters')
    .update({
      gmail_access_token:  tokens.access_token,
      gmail_refresh_token: tokens.refresh_token ?? null,
      gmail_token_expiry:  expiry,
    })
    .eq('user_id', user.id)

  if (updateErr) {
    console.error('[google-auth] recruiter update failed:', updateErr.message)
    return res.status(500).json({ error: 'db_error' })
  }

  return res.status(200).json({ success: true })
}
