import { useEffect } from 'react'
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react'
import './toast-notification.css'

const ICON_MAP = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
}

const COLOR_MAP = {
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
}

/**
 * Toast notification component.
 * Props:
 *  - message: string
 *  - type: 'success' | 'error' | 'warning'
 *  - onClose: () => void
 *  - duration: number (ms, default 4000)
 */
function ToastNotification({ message, type = 'success', onClose, duration = 4000 }) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [onClose, duration])

  const Icon = ICON_MAP[type] || CheckCircle
  const color = COLOR_MAP[type] || COLOR_MAP.success

  return (
    <div className={`toast toast-${type}`} style={{ '--toast-color': color }}>
      <Icon size={20} style={{ color, flexShrink: 0 }} />
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  )
}

/**
 * Container that renders a list of toasts stacked from the top-right.
 * Props:
 *  - toasts: Array<{ id, message, type }>
 *  - removeToast: (id) => void
 */
export function ToastContainer({ toasts, removeToast }) {
  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <ToastNotification
          key={t.id}
          message={t.message}
          type={t.type}
          onClose={() => removeToast(t.id)}
        />
      ))}
    </div>
  )
}

export default ToastNotification
