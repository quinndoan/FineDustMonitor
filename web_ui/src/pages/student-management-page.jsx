import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Edit2, Trash2, Search, Loader2, Users, CloudDownload, ChevronLeft, ChevronRight } from 'lucide-react'
import StudentFormModal from '../components/student-form-modal'
import { ToastContainer } from '../components/toast-notification'
import { API_BASE_URL } from '../config'
import './student-management-page.css'

const API_URL = `${API_BASE_URL}/api/students`

/** Page size options for pagination */
const PAGE_SIZE_OPTIONS = [10, 20, 50]

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
  const [formData, setFormData] = useState({ mssv: '', card_id: '', full_name: '', email: '', faculty: '', class_name: '', course_year: '' })
  const [toasts, setToasts] = useState([])

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

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
    setFormData({ mssv: '', card_id: '', full_name: '', email: '', faculty: '', class_name: '', course_year: '' })
    setIsModalOpen(true)
  }

  const openEdit = (s) => {
    setEditingMssv(s.mssv)
    setFormData({ mssv: s.mssv, card_id: s.card_id || '', full_name: s.full_name, email: s.email || '', faculty: s.faculty || '', class_name: s.class_name || '', course_year: s.course_year || '' })
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
          body: JSON.stringify({ card_id: formData.card_id, full_name: formData.full_name, email: formData.email, faculty: formData.faculty || null, class_name: formData.class_name || null, course_year: formData.course_year || null }),
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
    if (!window.confirm('Đồng bộ sẽ quét tất cả các tab có prefix "SV_" (vd: SV_KHMT, SV_KTMT) từ Google Sheets. Tiếp tục?')) return
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

  const filtered = useMemo(() =>
    students.filter((s) =>
      s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.mssv.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.faculty || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.class_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.course_year || '').toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [students, searchTerm]
  )

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const startIdx = (currentPage - 1) * pageSize
  const endIdx = startIdx + pageSize
  const paginatedData = filtered.slice(startIdx, endIdx)

  // Generate page numbers to display
  const pageNumbers = useMemo(() => {
    const pages = []
    const maxVisible = 5
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    let end = Math.min(totalPages, start + maxVisible - 1)
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1)
    }
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }, [currentPage, totalPages])

  return (
    <div className="students-page">
      <div className="page-header students-header">
        <div>
          <h1>Quản lý Sinh viên</h1>
        </div>
        <div className="header-actions">
          <button className="btn-add btn-outline" onClick={handleSyncSheets}>
            <CloudDownload size={18} />
            Thêm từ Sheets
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
          placeholder="Tìm kiếm theo tên, MSSV, trường/viện, khóa hoặc lớp..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          id="search-students"
        />
      </div>

      {/* Record count */}
      {!isLoading && (
        <div className="table-count">
          Hiển thị <strong>{paginatedData.length}</strong> / <strong>{filtered.length}</strong> sinh viên
          {searchTerm && ` (lọc từ ${students.length} tổng)`}
        </div>
      )}

      {/* Student table */}
      <div className="table-card">
        {isLoading ? (
          <div className="loading-state">
            <Loader2 size={28} className="spin" />
            <span>Đang tải dữ liệu...</span>
          </div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>MSSV</th>
                  <th>Mã thẻ (Card ID)</th>
                  <th>Họ và Tên</th>
                  <th>Trường / Viện</th>
                  <th>Khóa</th>
                  <th>Lớp</th>
                  <th>Email</th>
                  <th style={{ width: 100, textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((s, i) => (
                  <tr key={s.mssv}>
                    <td className="row-num">{startIdx + i + 1}</td>
                    <td className="mssv-cell">{s.mssv}</td>
                    <td className="rfid-cell">{s.card_id}</td>
                    <td>{s.full_name}</td>
                    <td className="faculty-cell">{s.faculty || '—'}</td>
                    <td className="course-year-cell">{s.course_year || '—'}</td>
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
                    <td colSpan="9" className="empty-state">
                      <div className="empty-state-content">
                        <div className="empty-state-icon">
                          <Users size={28} />
                        </div>
                        <span>
                          {searchTerm ? 'Không tìm thấy kết quả' : 'Chưa có sinh viên nào'}
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {filtered.length > 0 && (
              <div className="table-pagination">
                <div className="pagination-info">
                  Trang {currentPage} / {totalPages}
                  <select
                    className="page-size-select"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    style={{ marginLeft: '0.75rem' }}
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>{size} / trang</option>
                    ))}
                  </select>
                </div>
                <div className="pagination-controls">
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    title="Trang trước"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {pageNumbers.map((num) => (
                    <button
                      key={num}
                      className={`pagination-btn${num === currentPage ? ' active' : ''}`}
                      onClick={() => setCurrentPage(num)}
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    title="Trang sau"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
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
