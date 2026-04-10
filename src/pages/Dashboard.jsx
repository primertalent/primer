import { useAuth } from '../context/AuthContext'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const { user, signOut } = useAuth()

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="wordmark">Primer</span>
        <button className="btn-ghost" onClick={signOut}>Sign out</button>
      </header>

      <main className="app-main">
        <h1 className="greeting">{getGreeting()}</h1>
        <p className="greeting-sub">{user.email}</p>
      </main>
    </div>
  )
}
