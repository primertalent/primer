import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Landing() {
  const { user, loading } = useAuth()

  if (loading) return null
  if (user) return <Navigate to="/wren" replace />

  return (
    <div style={{
      background: 'var(--bg)',
      minHeight: '100svh',
      padding: '72px 24px 56px',
    }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        <header style={{ marginBottom: 40 }}>
          <h1 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 32,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            lineHeight: 1,
            color: 'var(--ink)',
            margin: '0 0 14px',
            fontVariationSettings: '"opsz" 144',
          }}>
            Wren
          </h1>
          <p style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 19,
            lineHeight: 1.4,
            color: 'var(--ink)',
            margin: 0,
          }}>
            The entry-level recruiter you can't hire.
          </p>
        </header>

        <section style={{ borderTop: '1px solid var(--hair)', paddingTop: 32, marginBottom: 40 }}>
          <p style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 16,
            lineHeight: 1.7,
            color: 'var(--ink)',
            margin: 0,
          }}>
            Wren drafts client submittals in your voice and screens candidates against your open roles. It watches your active pipeline and flags deals that are going quiet or missing a critical signal before the close. An AI recruiting assistant for solo independent recruiters who run their entire desk alone.
          </p>
        </section>

        <section style={{ borderTop: '1px solid var(--hair)', paddingTop: 32, marginBottom: 40 }}>
          <h2 style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            color: 'var(--mute)',
            margin: '0 0 14px',
          }}>
            How Wren uses your Google account
          </h2>
          <p style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 16,
            lineHeight: 1.7,
            color: 'var(--ink)',
            margin: 0,
          }}>
            With your permission, Wren sends emails you explicitly approve from your Gmail. Wren cannot send anything you haven't reviewed first. Wren also reads your Google Calendar to prepare briefing materials before scheduled interviews. See our{' '}
            <a href="/privacy.html" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>
              Privacy Policy
            </a>
            {' '}for full details.
          </p>
        </section>

        <div style={{ marginBottom: 72 }}>
          <Link
            to="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 40,
              padding: '0 20px',
              background: 'var(--ink)',
              color: 'var(--ink-inverse)',
              fontFamily: 'var(--font)',
              fontSize: 14,
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            Sign in
          </Link>
        </div>

        <footer style={{ borderTop: '1px solid var(--hair)', paddingTop: 24 }}>
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            color: 'var(--mute)',
            margin: 0,
          }}>
            Primer Talent LLC
            {' · '}
            <a href="/privacy.html" style={{ color: 'var(--mute)', textDecoration: 'underline' }}>
              Privacy Policy
            </a>
            {' · '}
            <a href="mailto:hello@primertalent.com" style={{ color: 'var(--mute)', textDecoration: 'underline' }}>
              hello@primertalent.com
            </a>
          </p>
        </footer>

      </div>
    </div>
  )
}
