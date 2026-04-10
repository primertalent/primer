import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function SignUp() {
  const { signUp } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await signUp(email, password)

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setConfirmed(true)
    }
  }

  if (confirmed) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="wordmark">Primer</h1>
            <p>Check your email</p>
          </div>
          <p className="confirm-message">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then sign in.
          </p>
          <p className="auth-footer">
            <Link to="/login">Back to sign in</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="wordmark">Primer</h1>
          <p>Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
