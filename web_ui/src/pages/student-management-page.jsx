import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, Search, Loader2, Users, CloudDownload } from 'lucide-react'
import StudentFormModal from '../components/student-form-modal'
import { ToastContainer } from '../components/toast-notification'
import './student-management-page.css'

const API_URL = 'http://localhost:8000/api/students'

/**
 * Student management page with full CRUD operations.
 * Data is synced with Google Sheets through the FastAPI backend.
 */
function StudentManagementPage() {
  const [students, setStudents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingMssv, setEditingMssv] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({ mssv: '', card_id: '', full_name: '', email: '', faculty: '', class_name: '' })
  const [toasts, setToasts] = useState([])

  /** Add a toast message */
  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  /** Remove a toast by id */
  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    fetchStudents()
  }, [])

  const fetchStudents = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')
      const res = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) setStudents(await res.json())
    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const openAdd = () => {
    setEditingMssv(null)
    setFormData({ mssv: '', card_id: '', full_name: '', email: '', faculty: '', class_name: '' })
    setIsModalOpen(true)
  }

  const openEdit = (s) => {
    setEditingMssv(s.mssv)
    setFormData({ mssv: s.mssv, card_id: s.card_id || '', full_name: s.full_name, email: s.email || '', faculty: s.faculty || '', class_name: s.class_name || '' })
    setIsModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem('token')
      let res
      if (editingMssv) {
        res = await fetch(`${API_URL}/${editingMssv}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ card_id: formData.card_id, full_name: formData.full_name, email: formData.email, faculty: formData.faculty || null, class_name: formData.class_name || null }),
        })
      } else {
        res = await fetch(API_URL, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData),
        })
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        const detail = errData?.detail || `Lỗi server (${res.status})`
        addToast(detail, 'error')
        return
      }

      setIsModalOpen(false)
      addToast(editingMssv ? 'Cập nhật sinh viên thành công!' : 'Thêm sinh viên thành công!', 'success')
      fetchStudents()
    } catch (err) {
      console.error('Submit error:', err)
      addToast('Không thể kết nối đến server. Vui lòng kiểm tra lại!', 'error')
    }
  }

  const handleDelete = async (mssv) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa sinh viên này?')) return
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/${mssv}`, { 
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        addToast(errData?.detail || `Xóa thất bại (${res.status})`, 'error')
        return
      }
      addToast('Đã xóa sinh viên thành công!', 'success')
      fetchStudents()
    } catch (err) {
      console.error('Delete error:', err)
      addToast('Không thể kết nối đến server!', 'error')
    }
  }

  const handleSyncSheets = async () => {
    if (!window.confirm('Đồng bộ sẽ tải danh sách sinh viên mới từ Google Sheets (tab "Students"). Tiếp tục?')) return
    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/sync-from-sheets`, { 
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) {
        addToast(data?.detail || `Đồng bộ thất bại (${res.status})`, 'error')
        return
      }
      addToast(data.message, 'success')
      fetchStudents()
    } catch (err) {
      console.error('Sync error:', err)
      addToast('Không thể kết nối đến server!', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const filtered = students.filter((s) =>
    s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.mssv.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.faculty || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.class_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="students-page">
      <div className="page-header students-header">
        <div>
          <h1>Quản lý Sinh viên</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-add" onClick={handleSyncSheets} style={{ background: '#10b981' }}>
            <CloudDownload size={18} />
            Đồng bộ từ Sheets
          </button>
          <button className="btn-add" onClick={openAdd} id="btn-add-student">
            <Plus size={18} />
            Thêm Sinh Viên
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="search-bar">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          placeholder="Tìm kiếm theo tên hoặc MSSV..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          id="search-students"
        />
      </div>

      {/* Student table */}
      <div className="table-card">
        {isLoading ? (
          <div className="loading-state">
            <Loader2 size={28} className="spin" />
            <span>Đang tải dữ liệu...</span>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>MSSV</th>
                <th>Mã thẻ (Card ID)</th>
                <th>Họ và Tên</th>
                <th>Khoa</th>
                <th>Lớp</th>
                <th>Email</th>
                <th style={{ width: 100, textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.mssv}>
                  <td className="row-num">{i + 1}</td>
                  <td className="mssv-cell">{s.mssv}</td>
                  <td className="rfid-cell">{s.card_id}</td>
                  <td>{s.full_name}</td>
                  <td className="faculty-cell">{s.faculty || '—'}</td>
                  <td className="class-cell">{s.class_name || '—'}</td>
                  <td>{s.email}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-btn edit"
                        onClick={() => openEdit(s)}
                        title="Sửa"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        className="icon-btn delete"
                        onClick={() => handleDelete(s.mssv)}
                        title="Xóa"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="8" className="empty-state">
                    <Users size={40} />
                    <span>
                      {searchTerm ? 'Không tìm thấy kết quả' : 'Chưa có sinh viên nào'}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <StudentFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        formData={formData}
        onChange={handleChange}
        isEditing={!!editingMssv}
      />

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}

export default StudentManagementPage
