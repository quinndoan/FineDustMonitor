import { X } from 'lucide-react'
import './student-form-modal.css'

/**
 * Reusable modal for adding or editing a student.
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - onSubmit: () => void
 *  - formData: { mssv, rfid, name }
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
            <label htmlFor="modal-rfid">Mã thẻ (RFID)</label>
            <input
              id="modal-rfid"
              type="text"
              name="rfid"
              value={formData.rfid}
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
              name="name"
              value={formData.name}
              onChange={onChange}
              required
              placeholder="Nhập tên sinh viên"
            />
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
