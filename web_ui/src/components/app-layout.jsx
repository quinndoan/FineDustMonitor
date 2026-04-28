import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, LogOut, Activity, DoorOpen, Calendar, Wifi } from 'lucide-react'
import { useAuth } from '../contexts/auth-context'
import './app-layout.css'

/**
 * Application shell with sidebar navigation.
 * Wraps all authenticated pages (Dashboard, Student Management).
 * Shows current user info and handles real logout (clears JWT).
 */
function AppLayout() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
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
          <NavLink
            to="/exam-rooms"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <DoorOpen size={20} />
            <span>Phòng thi</span>
          </NavLink>
          <NavLink
            to="/schedule"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Calendar size={20} />
            <span>Lịch thi</span>
          </NavLink>
          <NavLink
            to="/devices"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Wifi size={20} />
            <span>Thiết bị</span>
          </NavLink>
        </nav>

        {/* User info + logout at bottom */}
        <div className="sidebar-footer">
          {user && (
            <div className="user-info">
              <div className="user-avatar">
                {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="user-details">
                <span className="user-name">{user.full_name}</span>
                <span className="user-dept">{user.department || 'Giảng viên'}</span>
              </div>
            </div>
          )}
          <button className="nav-item logout" onClick={handleLogout} id="btn-logout">
            <LogOut size={20} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
