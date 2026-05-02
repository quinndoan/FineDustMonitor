import { X } from 'lucide-react'
import './student-form-modal.css'

/**
 * 13 official training units for faculty dropdown.
 */
const FACULTIES = [
  'Trường Cơ khí',
  'Trường Công nghệ Thông tin và Truyền thông',
  'Trường Điện - Điện tử',
  'Trường Vật liệu',
  'Trường Hóa và Khoa học sự sống',
  'Trường Kinh tế',
  'Khoa Khoa học và Công nghệ Giáo dục',
  'Khoa Vật lý kỹ thuật',
  'Khoa Toán - Tin',
  'Khoa Ngoại ngữ',
  'Khoa Giáo dục Quốc phòng và An ninh',
  'Khoa Giáo dục thể chất',
  'Khoa Lý luận chính trị',
]

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
              placeholder="Nhập email sinh viên"
            />
          </div>

          {/* Faculty dropdown + Class text input */}
          <div className="field-row">
            <div className="field-group">
              <label htmlFor="modal-faculty">Khoa / Trường</label>
              <select
                id="modal-faculty"
                name="faculty"
                value={formData.faculty}
                onChange={onChange}
              >
                <option value="">-- Chọn Khoa --</option>
                {FACULTIES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Class name - free text input */}
            <div className="field-group">
              <label htmlFor="modal-class">Lớp</label>
              <input
                id="modal-class"
                type="text"
                name="class_name"
                value={formData.class_name}
                onChange={onChange}
                placeholder="Nhập tên lớp (vd: KHMT, KTMT)"
              />
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
