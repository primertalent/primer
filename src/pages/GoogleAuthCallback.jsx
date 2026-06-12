/*
 * GoogleAuthCallback — handles Google OAuth redirect after recruiter connects Gmail
 *
 * Flow:
 *   1. Google redirects here with ?code= after recruiter approves the OAuth prompt
 *   2. This page reads the code, verifies the Supabase session is still live
 *   3. Calls api/google-auth to exchange the code for tokens and store them
 *   4. Redirects to /desk
 *
 * If the Supabase session is gone (rare — browser was closed mid-flow), redirects
 * to /login rather than crashing. The recruiter can reconnect Gmail after re-auth.
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function GoogleAuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    async function handleCallback() {
      const params = new URLSearchParams(window.location.search)
      const code  = params.get('code')
      const error = params.get('error')

      // Google returned an error (e.g. user denied access)
      if (error || !code) {
        console.warn('[GoogleAuthCallback] OAuth denied or missing code:', error)
        navigate('/wren')
        return
      }

      // Verify the Supabase session is still alive
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/login')
        return
      }

      // Exchange code for tokens server-side
      try {
        const redirectUri = `${window.location.origin}/auth/google/callback`
        const res = await fetch(
          `/api/google-auth?code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        )
        const result = await res.json()
        if (!result.success) {
          console.error('[GoogleAuthCallback] token exchange failed:', result)
        }
      } catch (err) {
        console.error('[GoogleAuthCallback] fetch error:', err)
      }

      navigate('/wren?google_connected=1')
    }

    handleCallback()
  }, [])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'var(--bg, #eef1ee)',
    }}>
      <p style={{
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: '12px',
        textTransform: 'uppercase',
        letterSpacing: '0.14em',
        color: 'var(--mute, #55625c)',
      }}>
        Connecting Gmail&hellip;
      </p>
    </div>
  )
}
