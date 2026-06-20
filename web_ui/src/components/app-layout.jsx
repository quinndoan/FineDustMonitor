import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, LogOut, Activity, DoorOpen, Calendar, Wifi, UserCog } from 'lucide-react'
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
            <Activity size={22} />
          </div>
          <div className="logo-text">
            <span className="logo-title">Monitor Student</span>
            <span className="logo-subtitle">Hệ thống giám sát</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {/* Main section */}
          <span className="nav-section-label">Tổng quan</span>
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <LayoutDashboard size={20} className="nav-icon" />
            <span>Dashboard</span>
          </NavLink>

          <div className="nav-divider" />

          {/* Management section */}
          <span className="nav-section-label">Quản lý</span>
          <NavLink
            to="/students"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Users size={20} className="nav-icon" />
            <span>Sinh Viên</span>
          </NavLink>
          <NavLink
            to="/exam-rooms"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <DoorOpen size={20} className="nav-icon" />
            <span>Phòng thi</span>
          </NavLink>
          <NavLink
            to="/schedule"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Calendar size={20} className="nav-icon" />
            <span>Lịch thi</span>
          </NavLink>

          <div className="nav-divider" />

          {/* Settings section */}
          <span className="nav-section-label">Hệ thống</span>
          <NavLink
            to="/devices"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Wifi size={20} className="nav-icon" />
            <span>Thiết bị</span>
          </NavLink>
          <NavLink
            to="/profile"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <UserCog size={20} className="nav-icon" />
            <span>Tài khoản</span>
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
            <LogOut size={20} className="nav-icon" />
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
