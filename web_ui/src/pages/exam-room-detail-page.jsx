import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, UserPlus, Trash2, Loader2, Users, CloudDownload, Wifi, Lock, Unlock } from 'lucide-react'
import { ToastContainer } from '../components/toast-notification'
import { API_BASE_URL, WS_BASE_URL } from '../config'
import './student-management-page.css' // Reuse styles
import './exam-room-detail-page.css'

function ExamRoomDetailPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  
  const [roomInfo, setRoomInfo] = useState(null)
  const [students, setStudents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [newMssv, setNewMssv] = useState('')
  const [toasts, setToasts] = useState([])
  const [allDevices, setAllDevices] = useState([])
  const [assignedDevices, setAssignedDevices] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    fetchRoomInfo()
    fetchStudents()
    fetchDevices()

    // Realtime WebSocket connection
    const ws = new WebSocket(`${WS_BASE_URL}/api/exam-rooms/ws/${roomId}`)
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.event === 'student_checked_in') {
        setStudents(prev => prev.map(s => 
          s.mssv === data.mssv ? { ...s, attendance_status: data.status } : s
        ))
      }
    }

    return () => {
      ws.close()
    }
  }, [roomId])

  const fetchDevices = async () => {
    try {
      const token = localStorage.getItem('token')
      const [resAll, resAssigned] = await Promise.all([
        fetch(`${API_BASE_URL}/api/devices`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/exam-rooms/${roomId}/devices`, { headers: { Authorization: `Bearer ${token}` } })
      ])
      if (resAll.ok) setAllDevices(await resAll.json())
      if (resAssigned.ok) setAssignedDevices(await resAssigned.json())
    } catch (err) {
      console.error(err)
    }
  }

  const fetchRoomInfo = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE_URL}/api/exam-rooms`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const rooms = await res.json()
        const room = rooms.find(r => r.id === parseInt(roomId))
        if (room) setRoomInfo(room)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchStudents = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE_URL}/api/exam-rooms/${roomId}/students`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setStudents(await res.json())
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddStudent = async (e) => {
    e.preventDefault()
    if (!newMssv.trim()) return

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE_URL}/api/exam-rooms/${roomId}/students`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ mssv: newMssv.trim() }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        addToast(errData?.detail || 'Thêm sinh viên thất bại', 'error')
        return
      }

      setNewMssv('')
      addToast('Thêm sinh viên thành công!', 'success')
      fetchStudents()
    } catch (err) {
      console.error(err)
      addToast('Không thể kết nối đến server.', 'error')
    }
  }

  const handleSyncSheets = async () => {
    const sheetName = window.prompt('Nhập tên Sheet chứa danh sách MSSV (vd: Thi_Giua_Ky):')
    if (!sheetName || !sheetName.trim()) return

    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE_URL}/api/exam-rooms/${roomId}/students/sync`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ sheet_name: sheetName.trim() })
      })
      const data = await res.json()
      if (!res.ok) {
        addToast(data?.detail || `Đồng bộ thất bại`, 'error')
        return
      }
      addToast(data.message, 'success')
      fetchStudents()
    } catch (err) {
      console.error(err)
      addToast('Lỗi kết nối!', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveStudent = async (mssv) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa sinh viên ${mssv} khỏi lớp thi này?`)) return
    
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE_URL}/api/exam-rooms/${roomId}/students/${mssv}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        addToast(errData?.detail || 'Xóa thất bại', 'error')
        return
      }

      addToast('Đã xóa sinh viên khỏi lớp thi!', 'success')
      fetchStudents()
    } catch (err) {
      console.error(err)
      addToast('Lỗi kết nối!', 'error')
    }
  }

  const handleAssignDevice = async () => {
    if (!selectedDeviceId) return
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE_URL}/api/exam-rooms/${roomId}/devices/${selectedDeviceId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        addToast('Gán thiết bị thành công', 'success')
        setSelectedDeviceId('')
        fetchDevices()
      } else {
        const errData = await res.json().catch(()=>null)
        addToast(errData?.detail || 'Gán thiết bị thất bại', 'error')
      }
    } catch (err) {
      addToast('Lỗi kết nối', 'error')
    }
  }

  const handleRemoveDevice = async (deviceId) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE_URL}/api/exam-rooms/${roomId}/devices/${deviceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        addToast('Đã gỡ thiết bị', 'success')
        fetchDevices()
      } else {
        const errData = await res.json().catch(()=>null)
        addToast(errData?.detail || 'Gỡ thiết bị thất bại', 'error')
      }
    } catch (err) {
      addToast('Lỗi kết nối', 'error')
    }
  }

  // Count attendance stats
  const presentCount = students.filter(s => s.attendance_status === 'PRESENT').length
  const absentCount = students.length - presentCount

  const handleToggleActive = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE_URL}/api/exam-rooms/${roomId}/toggle-active`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const updated = await res.json()
        setRoomInfo(updated)
        addToast(updated.is_active ? 'Đã mở điểm danh' : 'Đã đóng điểm danh', 'success')
      } else {
        addToast('Lỗi thay đổi trạng thái', 'error')
      }
    } catch (err) {
      addToast('Lỗi kết nối', 'error')
    }
  }

  return (
    <div className="students-page">
      {/* Header with back button */}
      <div className="page-header students-header">
        <div className="detail-header-left">
          <button className="back-btn" onClick={() => navigate('/exam-rooms')} title="Quay lại">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1>Chi tiết Lớp thi</h1>
            {roomInfo ? (
              <p className="detail-subtitle">
                <span className="detail-room-badge">{roomInfo.room_name}</span>
                {roomInfo.subject} — {new Date(roomInfo.exam_date).toLocaleDateString('vi-VN')}
              </p>
            ) : (
              <p>Đang tải thông tin lớp thi...</p>
            )}
          </div>
        </div>
        {roomInfo && (
          <button
            className={`btn-toggle-active ${roomInfo.is_active ? 'active' : 'closed'}`}
            onClick={handleToggleActive}
            title={roomInfo.is_active ? 'Đóng điểm danh' : 'Mở điểm danh'}
          >
            {roomInfo.is_active ? <><Unlock size={18} /> Đang mở điểm danh</> : <><Lock size={18} /> Đã đóng điểm danh</>}
          </button>
        )}
      </div>

      {/* Attendance Summary */}
      {!isLoading && students.length > 0 && (
        <div className="attendance-summary">
          <div className="attendance-stat present">
            <span className="attendance-value">{presentCount}</span>
            <span className="attendance-label">Có mặt</span>
          </div>
          <div className="attendance-stat absent">
            <span className="attendance-value">{absentCount}</span>
            <span className="attendance-label">Vắng</span>
          </div>
          <div className="attendance-stat total">
            <span className="attendance-value">{students.length}</span>
            <span className="attendance-label">Tổng SV</span>
          </div>
        </div>
      )}

      {/* Device Assignment Card */}
      <div className="device-assignment-card">
        <h3 className="device-card-title">
          <Wifi size={18} /> Thiết bị ESP32 điểm danh
        </h3>
        
        <div className="device-chips">
          {assignedDevices.map(d => (
            <div key={d.id} className="device-chip">
              <span className="device-chip-name">{d.name} ({d.device_id})</span>
              <button onClick={() => handleRemoveDevice(d.id)} className="device-chip-remove" title="Gỡ thiết bị">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {assignedDevices.length === 0 && (
            <span className="device-empty-text">Chưa có thiết bị nào được gán cho phòng này.</span>
          )}
        </div>

        <div className="device-assign-row">
          <select 
            value={selectedDeviceId} 
            onChange={e => setSelectedDeviceId(e.target.value)}
            className="device-select"
          >
            <option value="">-- Chọn thiết bị --</option>
            {allDevices.filter(d => d.assigned_room_id !== parseInt(roomId)).map(d => (
              <option key={d.id} value={d.id}>{d.name} ({d.device_id})</option>
            ))}
          </select>
          <button onClick={handleAssignDevice} className="btn-add" disabled={!selectedDeviceId} style={{ opacity: selectedDeviceId ? 1 : 0.5 }}>
            Gán thiết bị
          </button>
        </div>
      </div>

      {/* Add student form */}
      <div className="add-student-bar">
        <form onSubmit={handleAddStudent} className="add-student-form">
          <input
            type="text"
            placeholder="Nhập MSSV để thêm vào lớp thi..."
            value={newMssv}
            onChange={(e) => setNewMssv(e.target.value)}
            className="add-student-input"
          />
          <button type="submit" className="btn-add">
            <UserPlus size={18} />
            Thêm
          </button>
        </form>
        <button onClick={handleSyncSheets} className="btn-add btn-outline">
          <CloudDownload size={18} />
          Thêm từ Sheets
        </button>
      </div>

      {/* Student table */}
      <div className="table-card">
        {isLoading ? (
          <div className="loading-state">
            <Loader2 size={28} className="spin" />
            <span>Đang tải danh sách...</span>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>MSSV</th>
                <th>Mã thẻ (Card ID)</th>
                <th>Họ và Tên</th>
                <th>Trạng thái điểm danh</th>
                <th style={{ width: 80, textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.mssv}>
                  <td className="row-num">{i + 1}</td>
                  <td className="mssv-cell">{s.mssv}</td>
                  <td className="rfid-cell">{s.card_id}</td>
                  <td>{s.full_name}</td>
                  <td>
                    <span className={`status-badge ${s.attendance_status === 'PRESENT' ? 'active' : 'blocked'}`}>
                      <span className="status-dot" />
                      {s.attendance_status === 'PRESENT' ? 'Có mặt' : 'Vắng'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn delete" onClick={() => handleRemoveStudent(s.mssv)} title="Xóa khỏi lớp">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-state">
                    <div className="empty-state-content">
                      <div className="empty-state-icon">
                        <Users size={28} />
                      </div>
                      <span>Chưa có sinh viên nào trong lớp thi này. Hãy nhập MSSV để thêm.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}

export default ExamRoomDetailPage
