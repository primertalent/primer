import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AppLayout({ children }) {
  const { signOut } = useAuth()

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="wordmark">Primer</span>
        <nav className="app-nav">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}
          >
            Brief
          </NavLink>
          <NavLink
            to="/candidates"
            className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}
          >
            Candidates
          </NavLink>
          <NavLink
            to="/roles"
            className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}
          >
            Roles
          </NavLink>
          <NavLink
            to="/queue"
            className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}
          >
            Queue
          </NavLink>
        </nav>
        <button className="btn-ghost" onClick={signOut}>Sign out</button>
      </header>

      <main className="app-main">
        {children}
      </main>
    </div>
  )
}
