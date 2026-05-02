import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, User, ArrowRight, Activity, Building2, Loader2, KeyRound, ArrowLeft, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../contexts/auth-context'
import './login-page.css'

const API_BASE = 'http://localhost:8000/api/auth'

/**
 * Login / Register / Forgot Password page.
 * Connects to POST /api/auth/login, POST /api/auth/register,
 * POST /api/auth/request-reset, and POST /api/auth/reset-password.
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

  // Forgot password state
  // Steps: null (hidden), 'email', 'otp', 'newpass', 'done'
  const [forgotStep, setForgotStep] = useState(null)
  const [forgotEmail, setForgotEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [forgotError, setForgotError] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

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

  // --- Forgot password handlers ---

  const openForgotPassword = () => {
    setForgotStep('email')
    setForgotEmail('')
    setOtpCode('')
    setNewPassword('')
    setConfirmNewPassword('')
    setForgotError('')
    setSuccessMessage('')
  }

  const closeForgotPassword = () => {
    setForgotStep(null)
    setForgotError('')
    setSuccessMessage('')
  }

  const handleRequestOtp = async (e) => {
    e.preventDefault()
    setForgotError('')

    if (!forgotEmail.trim()) {
      setForgotError('Vui lòng nhập email.')
      return
    }

    setForgotLoading(true)
    try {
      const res = await fetch(`${API_BASE}/request-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || 'Có lỗi xảy ra.')
      }

      setSuccessMessage('Mã xác nhận đã được gửi tới email của bạn.')
      setForgotStep('otp')
    } catch (err) {
      setForgotError(err.message)
    } finally {
      setForgotLoading(false)
    }
  }

  const handleVerifyAndReset = async (e) => {
    e.preventDefault()
    setForgotError('')
    setSuccessMessage('')

    if (!otpCode.trim()) {
      setForgotError('Vui lòng nhập mã xác nhận.')
      return
    }
    if (newPassword.length < 6) {
      setForgotError('Mật khẩu mới phải có ít nhất 6 ký tự.')
      return
    }
    if (newPassword !== confirmNewPassword) {
      setForgotError('Mật khẩu xác nhận không khớp.')
      return
    }

    setForgotLoading(true)
    try {
      const res = await fetch(`${API_BASE}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail,
          code: otpCode,
          new_password: newPassword,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || 'Có lỗi xảy ra.')
      }

      setForgotStep('done')
      setSuccessMessage(data.message)
    } catch (err) {
      setForgotError(err.message)
    } finally {
      setForgotLoading(false)
    }
  }

  // --- Render forgot password overlay ---
  const renderForgotPassword = () => {
    if (!forgotStep) return null

    return (
      <div className="forgot-overlay" onClick={closeForgotPassword}>
        <div className="forgot-card" onClick={(e) => e.stopPropagation()}>
          {/* Step: Email */}
          {forgotStep === 'email' && (
            <>
              <div className="forgot-header">
                <div className="forgot-icon">
                  <KeyRound size={28} />
                </div>
                <h2>Quên mật khẩu</h2>
                <p>Nhập email đã đăng ký để nhận mã xác nhận</p>
              </div>

              {forgotError && (
                <div className="login-error">{forgotError}</div>
              )}

              <form onSubmit={handleRequestOtp}>
                <div className="input-group">
                  <Mail size={18} className="input-icon" />
                  <input
                    type="email"
                    placeholder="Email đã đăng ký"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    autoFocus
                    id="forgot-email"
                  />
                </div>

                <button
                  type="submit"
                  className="login-btn"
                  disabled={forgotLoading}
                  id="forgot-submit-email"
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 size={18} className="spin" />
                      Đang gửi...
                    </>
                  ) : (
                    <>
                      Gửi mã xác nhận
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>

              <button className="forgot-back-btn" onClick={closeForgotPassword}>
                <ArrowLeft size={16} />
                Quay lại đăng nhập
              </button>
            </>
          )}

          {/* Step: OTP + New Password */}
          {forgotStep === 'otp' && (
            <>
              <div className="forgot-header">
                <div className="forgot-icon otp-icon">
                  <ShieldCheck size={28} />
                </div>
                <h2>Nhập mã xác nhận</h2>
                <p>Mã 6 số đã được gửi tới <strong>{forgotEmail}</strong></p>
              </div>

              {successMessage && (
                <div className="forgot-success">{successMessage}</div>
              )}

              {forgotError && (
                <div className="login-error">{forgotError}</div>
              )}

              <form onSubmit={handleVerifyAndReset}>
                <div className="input-group">
                  <ShieldCheck size={18} className="input-icon" />
                  <input
                    type="text"
                    placeholder="Mã xác nhận (6 số)"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    autoFocus
                    maxLength={6}
                    className="otp-input"
                    id="forgot-otp-code"
                  />
                </div>

                <div className="input-group">
                  <Lock size={18} className="input-icon" />
                  <input
                    type="password"
                    placeholder="Mật khẩu mới"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    id="forgot-new-password"
                  />
                </div>

                <div className="input-group">
                  <Lock size={18} className="input-icon" />
                  <input
                    type="password"
                    placeholder="Xác nhận mật khẩu mới"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    id="forgot-confirm-new-password"
                  />
                </div>

                <button
                  type="submit"
                  className="login-btn"
                  disabled={forgotLoading}
                  id="forgot-submit-reset"
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 size={18} className="spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      Đặt lại mật khẩu
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>

              <button
                className="forgot-back-btn"
                onClick={() => { setForgotStep('email'); setForgotError(''); setSuccessMessage(''); }}
              >
                <ArrowLeft size={16} />
                Quay lại nhập email
              </button>
            </>
          )}

          {/* Step: Done */}
          {forgotStep === 'done' && (
            <>
              <div className="forgot-header">
                <div className="forgot-icon done-icon">
                  <CheckCircle2 size={32} />
                </div>
                <h2>Thành công!</h2>
                <p>{successMessage}</p>
              </div>

              <button
                className="login-btn"
                onClick={closeForgotPassword}
                id="forgot-back-to-login"
              >
                Đăng nhập ngay
                <ArrowRight size={18} />
              </button>
            </>
          )}
        </div>
      </div>
    )
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
              <div className="input-group select-group">
                <Building2 size={18} className="input-icon" />
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  id="register-department"
                  className={!department ? 'placeholder-select' : ''}
                  required
                >
                  <option value="" disabled hidden>Khoa / Phòng ban</option>
                  <option value="Trường Cơ khí">Trường Cơ khí</option>
                  <option value="Trường Công nghệ Thông tin và Truyền thông">Trường Công nghệ Thông tin và Truyền thông</option>
                  <option value="Trường Điện - Điện tử">Trường Điện - Điện tử</option>
                  <option value="Trường Vật liệu">Trường Vật liệu</option>
                  <option value="Trường Hóa và Khoa học sự sống">Trường Hóa và Khoa học sự sống</option>
                  <option value="Trường Kinh tế">Trường Kinh tế</option>
                  <option value="Khoa Khoa học và Công nghệ Giáo dục">Khoa Khoa học và Công nghệ Giáo dục</option>
                  <option value="Khoa Vật lý kỹ thuật">Khoa Vật lý kỹ thuật</option>
                  <option value="Khoa Toán - Tin">Khoa Toán - Tin</option>
                  <option value="Khoa Ngoại ngữ">Khoa Ngoại ngữ</option>
                  <option value="Khoa Giáo dục Quốc phòng và An ninh">Khoa Giáo dục Quốc phòng và An ninh</option>
                  <option value="Khoa Giáo dục thể chất">Khoa Giáo dục thể chất</option>
                  <option value="Khoa Lý luận chính trị">Khoa Lý luận chính trị</option>
                </select>
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
          <p className="forgot-link" onClick={openForgotPassword} id="forgot-password-link">
            Quên mật khẩu?
          </p>
        )}
      </div>

      {/* Forgot password overlay */}
      {renderForgotPassword()}
    </div>
  )
}

export default LoginPage
