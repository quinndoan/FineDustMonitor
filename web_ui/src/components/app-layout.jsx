import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, LogOut, Activity } from 'lucide-react'
import './app-layout.css'

/**
 * Application shell with sidebar navigation.
 * Wraps all authenticated pages (Dashboard, Student Management).
 */
function AppLayout() {
  const navigate = useNavigate()

  const handleLogout = () => {
    navigate('/login')
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <Activity size={24} />
          </div>
          <span>MS</span>
        </div>

        <nav className="sidebar-nav">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink
            to="/students"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Users size={20} />
            <span>Quản lý SV</span>
          </NavLink>
        </nav>

        <button className="nav-item logout" onClick={handleLogout}>
          <LogOut size={20} />
          <span>Đăng xuất</span>
        </button>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
