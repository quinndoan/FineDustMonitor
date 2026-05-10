import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, UserPlus, Trash2, Loader2, Users, CloudDownload, Wifi } from 'lucide-react'
import { ToastContainer } from '../components/toast-notification'
import './student-management-page.css' // Reuse styles

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
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${wsProtocol}//localhost:8000/api/exam-rooms/ws/${roomId}`)
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.event === 'student_checked_in') {
        setStudents(prev => prev.map(s => 
          s.mssv === data.mssv ? { ...s, attendance_status: data.status } : s
        ))
        // Optional: you can show a toast
        // addToast(`Sinh viên ${data.mssv} điểm danh thành công!`, 'success')
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
        fetch('http://localhost:8000/api/devices', { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`http://localhost:8000/api/exam-rooms/${roomId}/devices`, { headers: { Authorization: `Bearer ${token}` } })
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
      const res = await fetch('http://localhost:8000/api/exam-rooms', {
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
      const res = await fetch(`http://localhost:8000/api/exam-rooms/${roomId}/students`, {
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
      const res = await fetch(`http://localhost:8000/api/exam-rooms/${roomId}/students`, {
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
      const res = await fetch(`http://localhost:8000/api/exam-rooms/${roomId}/students/sync`, {
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
      const res = await fetch(`http://localhost:8000/api/exam-rooms/${roomId}/students/${mssv}`, {
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
      const res = await fetch(`http://localhost:8000/api/exam-rooms/${roomId}/devices/${selectedDeviceId}`, {
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
      const res = await fetch(`http://localhost:8000/api/exam-rooms/${roomId}/devices/${deviceId}`, {
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

  return (
    <div className="students-page">
      <div className="page-header students-header">
        <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
          <button className="icon-btn" onClick={() => navigate('/exam-rooms')} style={{background: 'rgba(255,255,255,0.1)', padding: '0.5rem', borderRadius: '8px'}}>
            <ArrowLeft size={20} color="#fff" />
          </button>
          <div>
            <h1>Chi tiết Lớp thi</h1>
            {roomInfo ? (
              <p>Phòng: {roomInfo.room_name} - Môn: {roomInfo.subject} ({new Date(roomInfo.exam_date).toLocaleDateString('vi-VN')})</p>
            ) : (
              <p>Đang tải thông tin lớp thi...</p>
            )}
          </div>
        </div>
      </div>

      <div className="device-assignment-card" style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '16px', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Wifi size={18} /> Thiết bị ESP32 điểm danh
        </h3>
        
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {assignedDevices.map(d => (
            <div key={d.id} style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', padding: '0.5rem 1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#60a5fa', fontWeight: 600 }}>{d.name} ({d.device_id})</span>
              <button onClick={() => handleRemoveDevice(d.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }} title="Gỡ thiết bị">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {assignedDevices.length === 0 && <span style={{ color: 'var(--text-secondary)', padding: '0.5rem 0' }}>Chưa có thiết bị nào được gán cho phòng này.</span>}
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <select 
            value={selectedDeviceId} 
            onChange={e => setSelectedDeviceId(e.target.value)}
            style={{ padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-color)', border: '1px solid var(--border-color)', color: '#fff', flex: 1, maxWidth: '300px' }}
          >
            <option value="">-- Chọn thiết bị chưa sử dụng --</option>
            {allDevices.filter(d => d.assigned_room_id !== parseInt(roomId)).map(d => (
              <option key={d.id} value={d.id}>{d.name} ({d.device_id})</option>
            ))}
          </select>
          <button onClick={handleAssignDevice} className="btn-add" disabled={!selectedDeviceId} style={{ opacity: selectedDeviceId ? 1 : 0.5 }}>
            Gán thiết bị
          </button>
        </div>
      </div>

      <div className="search-bar" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <form onSubmit={handleAddStudent} style={{ display: 'flex', flex: 1, gap: '1rem' }}>
          <input
            type="text"
            placeholder="Nhập MSSV để thêm vào lớp thi..."
            value={newMssv}
            onChange={(e) => setNewMssv(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn-add" style={{ padding: '0 1.5rem', height: '100%' }}>
            <UserPlus size={18} />
            Thêm
          </button>
        </form>
        <button onClick={handleSyncSheets} className="btn-add" style={{ background: '#10b981', height: '100%', whiteSpace: 'nowrap' }}>
          <CloudDownload size={18} />
          Thêm từ Sheets
        </button>
      </div>

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
                <th style={{ width: 100, textAlign: 'center' }}>Thao tác</th>
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
                    <span style={{
                      padding: '4px 10px', 
                      borderRadius: '12px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      background: s.attendance_status === 'PRESENT' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: s.attendance_status === 'PRESENT' ? '#4ade80' : '#f87171'
                    }}>
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
                    <Users size={40} />
                    <span>Chưa có sinh viên nào trong lớp thi này. Hãy nhập MSSV để thêm.</span>
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
