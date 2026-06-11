import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { WrenMark } from './WrenMark'

export default function AppLayout({ children, fullBleed = false, thinking = false }) {
  const { signOut } = useAuth()

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <WrenMark state={thinking ? 'thinking' : 'idle'} size={28} />
          <span className="brand-name">Wren</span>
        </div>
        <nav className="app-nav">
          <NavLink
            to="/wren"
            className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}
          >
            Wren
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
