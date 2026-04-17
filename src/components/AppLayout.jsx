import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import WrenResponse from './WrenResponse'

export default function AppLayout({ children, fullBleed = false }) {
  const { signOut } = useAuth()

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="wordmark">Wren</span>
        <nav className="app-nav">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}
          >
            Home
          </NavLink>
          <NavLink
            to="/roles"
            className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}
          >
            Roles
          </NavLink>
          <NavLink
            to="/candidates"
            className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}
          >
            Candidates
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

      {fullBleed
        ? <div className="app-full">{children}</div>
        : <main className="app-main">{children}</main>
      }
      <WrenResponse />
    </div>
  )
}
