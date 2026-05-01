import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import birdMark from '../../wren-bird-mark.png'

export default function AppLayout({ children, fullBleed = false }) {
  const { signOut } = useAuth()

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <img src={birdMark} className="brand-mark" alt="" aria-hidden="true" />
          <span className="brand-name">Wren</span>
        </div>
        <nav className="app-nav">
          <NavLink
            to="/desk"
            className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}
          >
            Desk
          </NavLink>
          <NavLink
            to="/roles"
            className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}
          >
            Deals
          </NavLink>
          <NavLink
            to="/network"
            className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}
          >
            Network
          </NavLink>
        </nav>
        <button className="btn-ghost" onClick={signOut}>Sign out</button>
      </header>

      {fullBleed
        ? <div className="app-full">{children}</div>
        : <main className="app-main">{children}</main>
      }
    </div>
  )
}
