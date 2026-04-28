import { X } from 'lucide-react'
import './student-form-modal.css'

/**
 * Faculty → Class mapping for Vietnamese university departments.
 * Used to populate dependent dropdowns.
 */
const FACULTY_CLASS_MAP = {
  'CNTT và Truyền thông': ['KHMT', 'KTMT', 'CNPM', 'HTTT', 'ATTT', 'MMT&TT'],
  'Điện': ['KTĐ', 'TĐH', 'ĐTCN'],
  'Điện - Điện tử': ['KTĐT', 'ĐTVT', 'KTYS'],
  'Cơ khí': ['CKCT', 'CĐT', 'CNOTO'],
  'Xây dựng': ['XDDD&CN', 'KTHT', 'VLXD'],
  'Kinh tế': ['QTKD', 'TCNH', 'KT'],
  'Ngoại ngữ': ['NNA', 'NNP', 'NNT'],
}

const FACULTIES = Object.keys(FACULTY_CLASS_MAP)

/**
 * Reusable modal for adding or editing a student.
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - onSubmit: () => void
 *  - formData: { mssv, card_id, full_name, email, faculty, class_name }
 *  - onChange: (e) => void
 *  - isEditing: boolean
 */
function StudentFormModal({ isOpen, onClose, onSubmit, formData, onChange, isEditing }) {
  if (!isOpen) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit()
  }

  // Get available classes for the currently selected faculty
  const availableClasses = formData.faculty
    ? (FACULTY_CLASS_MAP[formData.faculty] || [])
    : []

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Chỉnh sửa Sinh viên' : 'Thêm Sinh viên mới'}</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label htmlFor="modal-mssv">Mã số sinh viên (MSSV)</label>
            <input
              id="modal-mssv"
              type="text"
              name="mssv"
              value={formData.mssv}
              onChange={onChange}
              readOnly={isEditing}
              required
              placeholder="Nhập MSSV (vd: 20201234)"
            />
          </div>
          <div className="field-group">
            <label htmlFor="modal-rfid">Mã thẻ (Card ID)</label>
            <input
              id="modal-rfid"
              type="text"
              name="card_id"
              value={formData.card_id}
              onChange={onChange}
              required
              placeholder="Nhập mã thẻ từ"
            />
          </div>
          <div className="field-group">
            <label htmlFor="modal-name">Họ và Tên</label>
            <input
              id="modal-name"
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={onChange}
              required
              placeholder="Nhập tên sinh viên"
            />
          </div>
          <div className="field-group">
            <label htmlFor="modal-email">Email (tùy chọn)</label>
            <input
              id="modal-email"
              type="email"
              name="email"
              value={formData.email}
              onChange={onChange}
              placeholder="Nhập email sinh viên để gửi thông báo"
            />
          </div>

          {/* Faculty dropdown */}
          <div className="field-row">
            <div className="field-group">
              <label htmlFor="modal-faculty">Khoa / Trường</label>
              <select
                id="modal-faculty"
                name="faculty"
                value={formData.faculty}
                onChange={(e) => {
                  onChange(e)
                  // Reset class_name when faculty changes
                  onChange({ target: { name: 'class_name', value: '' } })
                }}
              >
                <option value="">-- Chọn Khoa --</option>
                {FACULTIES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Class dropdown (dependent on faculty) */}
            <div className="field-group">
              <label htmlFor="modal-class">Lớp</label>
              <select
                id="modal-class"
                name="class_name"
                value={formData.class_name}
                onChange={onChange}
                disabled={!formData.faculty}
              >
                <option value="">-- Chọn Lớp --</option>
                {availableClasses.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="btn-submit">
              {isEditing ? 'Cập nhật' : 'Thêm mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default StudentFormModal
