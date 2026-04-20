import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Search, Loader2, Users } from 'lucide-react'
import StudentFormModal from '../components/student-form-modal'
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
  const [formData, setFormData] = useState({ mssv: '', rfid: '', name: '' })

  useEffect(() => {
    fetchStudents()
  }, [])

  const fetchStudents = async () => {
    try {
      setIsLoading(true)
      const res = await fetch(API_URL)
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
    setFormData({ mssv: '', rfid: '', name: '' })
    setIsModalOpen(true)
  }

  const openEdit = (s) => {
    setEditingMssv(s.mssv)
    setFormData({ mssv: s.mssv, rfid: s.rfid, name: s.name })
    setIsModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      if (editingMssv) {
        await fetch(`${API_URL}/${editingMssv}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rfid: formData.rfid, name: formData.name }),
        })
      } else {
        await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
      }
      setIsModalOpen(false)
      fetchStudents()
    } catch (err) {
      console.error('Submit error:', err)
      alert('Lỗi: có thể bị trùng MSSV hoặc server chưa bật!')
    }
  }

  const handleDelete = async (mssv) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa sinh viên này?')) return
    try {
      await fetch(`${API_URL}/${mssv}`, { method: 'DELETE' })
      fetchStudents()
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.mssv.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="students-page">
      <div className="page-header students-header">
        <div>
          <h1>Quản lý Sinh viên</h1>
          <p>Quản lý danh sách sinh viên đồng bộ Google Sheets</p>
        </div>
        <button className="btn-add" onClick={openAdd} id="btn-add-student">
          <Plus size={18} />
          Thêm Sinh Viên
        </button>
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
                <th>RFID</th>
                <th>Họ và Tên</th>
                <th style={{ width: 100, textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.mssv}>
                  <td className="row-num">{i + 1}</td>
                  <td className="mssv-cell">{s.mssv}</td>
                  <td className="rfid-cell">{s.rfid}</td>
                  <td>{s.name}</td>
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
                  <td colSpan="5" className="empty-state">
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
    </div>
  )
}

export default StudentManagementPage
