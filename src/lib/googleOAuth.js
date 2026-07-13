/*
 * src/lib/googleOAuth.js — single source of truth for the Google OAuth consent URL.
 *
 * Both connect entry points import initiateGoogleOAuth from here so the requested
 * scope set can never drift between call sites:
 *   - src/components/wren/GoogleConnectCard.jsx
 *   - src/pages/Wren.jsx (inline Gmail hint button)
 *
 * Scope set — one consent covers all four (only calendar is consumed today; gmail
 * read and Meet are wired in later sessions):
 *   gmail.send                — send approved submittals (live in production)
 *   gmail.readonly            — inbound read (Session B)
 *   calendar.events.readonly  — calendar read (list_calendar, this session)
 *   drive.meet.readonly       — Meet transcripts/recordings (Session C)
 *
 * access_type=offline + prompt=consent are load-bearing. prompt=consent forces a
 * re-consent screen AND guarantees a fresh refresh_token covering the new scopes on
 * every run. The stored token is currently send-scoped; re-consent replaces it with
 * a superset, so existing send keeps working. Do NOT remove prompt=consent — see the
 * token-write invariant documented in api/google-auth.js.
 */

const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/drive.meet.readonly',
].join(' ')

export function initiateGoogleOAuth() {
  const params = new URLSearchParams({
    client_id:     import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri:  `${window.location.origin}/auth/google/callback`,
    response_type: 'code',
    scope:         GOOGLE_OAUTH_SCOPES,
    access_type:   'offline',
    prompt:        'consent',
  })
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}
