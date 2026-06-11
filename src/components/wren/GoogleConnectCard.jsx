function initiateGoogleOAuth() {
  const params = new URLSearchParams({
    client_id:     import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri:  `${window.location.origin}/auth/google/callback`,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/gmail.send',
    access_type:   'offline',
    prompt:        'consent',
  })
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export default function GoogleConnectCard() {
  return (
    <div className="google-connect-card">
      <p className="google-connect-card__text">
        Connect Google to send approved emails from your Gmail.
      </p>
      <button className="google-connect-card__btn" onClick={initiateGoogleOAuth}>
        CONNECT GOOGLE
      </button>
    </div>
  )
}
