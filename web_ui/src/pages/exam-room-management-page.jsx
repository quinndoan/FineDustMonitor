import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit2, Trash2, Search, Loader2, DoorOpen, Users, CloudDownload, ChevronLeft, ChevronRight } from 'lucide-react'
import ExamRoomFormModal from '../components/exam-room-form-modal'
import { ToastContainer } from '../components/toast-notification'
import './student-management-page.css' // Reusing styles

const API_URL = 'http://localhost:8000/api/exam-rooms'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

function ExamRoomManagementPage() {
  const navigate = useNavigate()
  const [rooms, setRooms] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  
  const defaultForm = { room_name: '', subject: '', exam_date: '', start_time: '', end_time: '' }
  const [formData, setFormData] = useState(defaultForm)
  const [toasts, setToasts] = useState([])

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    fetchRooms()
  }, [])

  const fetchRooms = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')
      const res = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) setRooms(await res.json())
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
    setEditingId(null)
    setFormData(defaultForm)
    setIsModalOpen(true)
  }

  const openEdit = (room) => {
    setEditingId(room.id)
    setFormData({ 
        room_name: room.room_name, 
        subject: room.subject, 
        exam_date: room.exam_date, 
        start_time: room.start_time, 
        end_time: room.end_time 
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem('token')
      let res
      if (editingId) {
        res = await fetch(`${API_URL}/${editingId}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData),
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
      addToast(editingId ? 'Cập nhật lớp thi thành công!' : 'Thêm lớp thi thành công!', 'success')
      fetchRooms()
    } catch (err) {
      console.error('Submit error:', err)
      addToast('Không thể kết nối đến server.', 'error')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa lớp thi này?')) return
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/${id}`, { 
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        addToast(errData?.detail || `Xóa thất bại (${res.status})`, 'error')
        return
      }
      addToast('Đã xóa lớp thi thành công!', 'success')
      fetchRooms()
    } catch (err) {
      console.error('Delete error:', err)
      addToast('Không thể kết nối đến server!', 'error')
    }
  }

  const filtered = rooms.filter((r) =>
    r.room_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.subject.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Reset page on search
  useEffect(() => { setCurrentPage(1) }, [searchTerm])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const startIdx = (currentPage - 1) * pageSize
  const paginatedData = filtered.slice(startIdx, startIdx + pageSize)

  const pageNumbers = (() => {
    const pages = []
    const maxVisible = 5
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    let end = Math.min(totalPages, start + maxVisible - 1)
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  })()

  const handleSyncSheets = async () => {
    if (!window.confirm('Đồng bộ sẽ quét tất cả tab có prefix "LichThi_" (vd: LichThi_1, LichThi_2) từ Google Sheets. Tiếp tục?')) return
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
      fetchRooms()
    } catch (err) {
      console.error('Sync error:', err)
      addToast('Không thể kết nối đến server!', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="students-page">
      <div className="page-header students-header">
        <div>
          <h1>Quản lý Lớp thi</h1>
        </div>
        <div className="header-actions">
          <button className="btn-add btn-outline" onClick={handleSyncSheets}>
            <CloudDownload size={18} />
            Thêm từ Sheets
          </button>
          <button className="btn-add" onClick={openAdd}>
            <Plus size={18} />
            Thêm Lớp thi
          </button>
        </div>
      </div>

      <div className="search-bar">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          placeholder="Tìm kiếm theo phòng hoặc môn..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Record count */}
      {!isLoading && (
        <div className="table-count">
          Hiển thị <strong>{paginatedData.length}</strong> / <strong>{filtered.length}</strong> lớp thi
        </div>
      )}

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
                  <th>Phòng thi</th>
                  <th>Môn thi</th>
                  <th>Ngày thi</th>
                  <th>Thời gian</th>
                  <th style={{ width: 120, textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((r) => (
                  <tr key={r.id}>
                    <td className="mssv-cell">{r.room_name}</td>
                    <td>{r.subject}</td>
                    <td>{new Date(r.exam_date).toLocaleDateString('vi-VN')}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.start_time.slice(0, 5)} - {r.end_time.slice(0, 5)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-btn edit" onClick={() => navigate(`/exam-rooms/${r.id}`)} title="Danh sách sinh viên" style={{ color: '#8b5cf6' }}>
                          <Users size={16} />
                        </button>
                        <button className="icon-btn edit" onClick={() => openEdit(r)} title="Sửa">
                          <Edit2 size={16} />
                        </button>
                        <button className="icon-btn delete" onClick={() => handleDelete(r.id)} title="Xóa">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="5" className="empty-state">
                      <div className="empty-state-content">
                        <div className="empty-state-icon">
                          <DoorOpen size={28} />
                        </div>
                        <span>
                          {searchTerm ? 'Không tìm thấy kết quả' : 'Chưa có lớp thi nào'}
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
                    onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
                    style={{ marginLeft: '0.75rem' }}
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>{size} / trang</option>
                    ))}
                  </select>
                </div>
                <div className="pagination-controls">
                  <button className="pagination-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                  {pageNumbers.map(num => (
                    <button key={num} className={`pagination-btn${num === currentPage ? ' active' : ''}`} onClick={() => setCurrentPage(num)}>{num}</button>
                  ))}
                  <button className="pagination-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ExamRoomFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        formData={formData}
        onChange={handleChange}
        isEditing={!!editingId}
      />

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}

export default ExamRoomManagementPage
