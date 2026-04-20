import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, User, ArrowRight, Activity } from 'lucide-react'
import './login-page.css'

/**
 * Login / Register page.
 * Currently just navigates directly to the dashboard on submit
 * (no real authentication). Tabs switch between login and register forms.
 */
function LoginPage() {
  const [isRegister, setIsRegister] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    navigate('/dashboard')
  }

  return (
    <div className="login-container">
      {/* Animated background orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <Activity size={32} />
          </div>
          <h1>Monitor Students</h1>
          <p>Hệ thống quản lý sinh viên vào phòng thi</p>
        </div>

        <div className="tab-switcher">
          <button
            className={`tab${!isRegister ? ' active' : ''}`}
            onClick={() => setIsRegister(false)}
          >
            Đăng nhập
          </button>
          <button
            className={`tab${isRegister ? ' active' : ''}`}
            onClick={() => setIsRegister(true)}
          >
            Đăng ký
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="input-group">
              <User size={18} className="input-icon" />
              <input type="text" placeholder="Họ và tên" required />
            </div>
          )}
          <div className="input-group">
            <Mail size={18} className="input-icon" />
            <input type="email" placeholder="Email" required />
          </div>
          <div className="input-group">
            <Lock size={18} className="input-icon" />
            <input type="password" placeholder="Mật khẩu" required />
          </div>
          {isRegister && (
            <div className="input-group">
              <Lock size={18} className="input-icon" />
              <input type="password" placeholder="Xác nhận mật khẩu" required />
            </div>
          )}

          <button type="submit" className="login-btn">
            {isRegister ? 'Đăng ký' : 'Đăng nhập'}
            <ArrowRight size={18} />
          </button>
        </form>

        {!isRegister && (
          <p className="forgot-link">Quên mật khẩu?</p>
        )}
      </div>
    </div>
  )
}

export default LoginPage
