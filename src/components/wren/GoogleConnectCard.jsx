import { initiateGoogleOAuth } from '../../lib/googleOAuth'

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
