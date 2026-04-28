import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, User, ArrowRight, Activity, Building2, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/auth-context'
import './login-page.css'

/**
 * Login / Register page.
 * Connects to POST /api/auth/login and POST /api/auth/register.
 * On success, stores JWT via AuthContext and navigates to dashboard.
 */
function LoginPage() {
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [department, setDepartment] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const navigate = useNavigate()
  const { login, register } = useAuth()

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setFullName('')
    setDepartment('')
    setError('')
  }

  const switchTab = (toRegister) => {
    setIsRegister(toRegister)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Client-side validation
    if (isRegister && password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.')
      return
    }
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.')
      return
    }

    setIsSubmitting(true)

    try {
      if (isRegister) {
        await register(email, password, fullName, department)
      } else {
        await login(email, password)
      }
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra. Vui lòng thử lại.')
    } finally {
      setIsSubmitting(false)
    }
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
            onClick={() => switchTab(false)}
          >
            Đăng nhập
          </button>
          <button
            className={`tab${isRegister ? ' active' : ''}`}
            onClick={() => switchTab(true)}
          >
            Đăng ký
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="login-error" id="login-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <>
              <div className="input-group">
                <User size={18} className="input-icon" />
                <input
                  type="text"
                  placeholder="Họ và tên"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  id="register-fullname"
                />
              </div>
              <div className="input-group">
                <Building2 size={18} className="input-icon" />
                <input
                  type="text"
                  placeholder="Khoa / Phòng ban (tuỳ chọn)"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  id="register-department"
                />
              </div>
            </>
          )}
          <div className="input-group">
            <Mail size={18} className="input-icon" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              id="login-email"
            />
          </div>
          <div className="input-group">
            <Lock size={18} className="input-icon" />
            <input
              type="password"
              placeholder="Mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              id="login-password"
            />
          </div>
          {isRegister && (
            <div className="input-group">
              <Lock size={18} className="input-icon" />
              <input
                type="password"
                placeholder="Xác nhận mật khẩu"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                id="register-confirm-password"
              />
            </div>
          )}

          <button type="submit" className="login-btn" disabled={isSubmitting} id="login-submit">
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="spin" />
                Đang xử lý...
              </>
            ) : (
              <>
                {isRegister ? 'Đăng ký' : 'Đăng nhập'}
                <ArrowRight size={18} />
              </>
            )}
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
