import { X } from 'lucide-react'
import './student-form-modal.css' // We can reuse the same modal styles for now

/**
 * Reusable modal for adding or editing an exam room.
 */
function ExamRoomFormModal({ isOpen, onClose, onSubmit, formData, onChange, isEditing }) {
  if (!isOpen) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Chỉnh sửa Lớp thi' : 'Thêm Lớp thi mới'}</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label htmlFor="modal-room-name">Tên phòng thi / Lớp thi</label>
            <input
              id="modal-room-name"
              type="text"
              name="room_name"
              value={formData.room_name}
              onChange={onChange}
              required
              placeholder="VD: P.402-D3"
            />
          </div>
          <div className="field-group">
            <label htmlFor="modal-subject">Môn thi</label>
            <input
              id="modal-subject"
              type="text"
              name="subject"
              value={formData.subject}
              onChange={onChange}
              required
              placeholder="VD: Cấu trúc dữ liệu"
            />
          </div>
          <div className="field-group">
            <label htmlFor="modal-exam-date">Ngày thi</label>
            <input
              id="modal-exam-date"
              type="date"
              name="exam_date"
              value={formData.exam_date}
              onChange={onChange}
              required
            />
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="field-group" style={{ flex: 1 }}>
              <label htmlFor="modal-start-time">Giờ bắt đầu</label>
              <input
                id="modal-start-time"
                type="time"
                name="start_time"
                value={formData.start_time}
                onChange={onChange}
                required
              />
            </div>
            <div className="field-group" style={{ flex: 1 }}>
              <label htmlFor="modal-end-time">Giờ kết thúc</label>
              <input
                id="modal-end-time"
                type="time"
                name="end_time"
                value={formData.end_time}
                onChange={onChange}
                required
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

export default ExamRoomFormModal
