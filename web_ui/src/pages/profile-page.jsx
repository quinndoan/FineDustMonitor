import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Mail, Building2, Save, Trash2, Loader2, AlertTriangle } from 'lucide-react'
import emailjs from '@emailjs/browser'
import { useAuth } from '../contexts/auth-context'
import './profile-page.css'

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID
const EMAILJS_TEMPLATE_NOTIFY_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_NOTIFY_ID
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

export default function ProfilePage() {
  const { user, updateProfile, deleteAccount } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState(user?.full_name || '')
  const [department, setDepartment] = useState(user?.department || '')
  const [email, setEmail] = useState(user?.email || '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const sendNotificationEmail = async (templateParams) => {
    if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_NOTIFY_ID || !EMAILJS_PUBLIC_KEY) return
    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_NOTIFY_ID, templateParams, EMAILJS_PUBLIC_KEY)
    } catch (e) {
      console.error('EmailJS error:', e)
    }
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)

    try {
      const updated = await updateProfile({ full_name: fullName, department, email })

      await sendNotificationEmail({
        to_email: updated.email,
        subject: 'Thông tin tài khoản đã được cập nhật',
        message: `Xin chào ${updated.full_name}, thông tin tài khoản của bạn đã được cập nhật thành công.`,
      })

      setMessage('Cập nhật thông tin thành công.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setError('')
    setDeleting(true)

    try {
      const result = await deleteAccount()

      await sendNotificationEmail({
        to_email: result.email,
        subject: 'Tài khoản đã bị xóa',
        message: `Xin chào ${result.full_name}, tài khoản của bạn đã được xóa khỏi hệ thống.`,
      })

      navigate('/login')
    } catch (err) {
      setError(err.message)
      setDeleting(false)
    }
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h1>Thông tin tài khoản</h1>
      </div>

      <div className="profile-card">
        {message && <div className="profile-success">{message}</div>}
        {error && <div className="profile-error">{error}</div>}

        <form onSubmit={handleUpdate}>
          <div className="profile-field">
            <label htmlFor="profile-name">
              <User size={16} />
              Họ và tên
            </label>
            <input
              id="profile-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="profile-field">
            <label htmlFor="profile-email">
              <Mail size={16} />
              Email
            </label>
            <input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="profile-field">
            <label htmlFor="profile-dept">
              <Building2 size={16} />
              Khoa / Phòng ban
            </label>
            <input
              id="profile-dept"
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-save" disabled={saving}>
            {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </form>

        <hr className="profile-divider" />

        <div className="danger-zone">
          <h3>
            <AlertTriangle size={16} />
            Vùng nguy hiểm
          </h3>
          <p>Xóa tài khoản sẽ không thể hoàn tác.</p>

          {!showDeleteConfirm ? (
            <button className="btn-delete" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 size={16} />
              Xóa tài khoản
            </button>
          ) : (
            <div className="delete-confirm">
              <p>Bạn có chắc chắn muốn xóa tài khoản?</p>
              <div className="delete-actions">
                <button className="btn-delete-confirm" onClick={handleDelete} disabled={deleting}>
                  {deleting ? <Loader2 size={16} className="spin" /> : null}
                  {deleting ? 'Đang xóa...' : 'Xác nhận xóa'}
                </button>
                <button className="btn-cancel" onClick={() => setShowDeleteConfirm(false)}>
                  Hủy
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
