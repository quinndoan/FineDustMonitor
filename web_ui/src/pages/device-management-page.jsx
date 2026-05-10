import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, Loader2, Wifi, X } from 'lucide-react'
import { ToastContainer } from '../components/toast-notification'
import './student-management-page.css'
import '../components/student-form-modal.css'

function DeviceManagementPage() {
  const [devices, setDevices] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [toasts, setToasts] = useState([])

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingDevice, setEditingDevice] = useState(null)
  
  const [deviceId, setDeviceId] = useState('')
  const [name, setName] = useState('')

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    fetchDevices()
  }, [])

  const fetchDevices = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')
      const res = await fetch('http://localhost:8000/api/devices', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setDevices(await res.json())
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const openModal = (device = null) => {
    if (device) {
      setEditingDevice(device)
      setDeviceId(device.device_id)
      setName(device.name)
    } else {
      setEditingDevice(null)
      setDeviceId('')
      setName('')
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingDevice(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!deviceId.trim() || !name.trim()) {
      addToast('Vui lòng nhập đủ Device ID và Tên.', 'error')
      return
    }

    try {
      const token = localStorage.getItem('token')
      if (editingDevice) {
        // Update
        const res = await fetch(`http://localhost:8000/api/devices/${editingDevice.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: name.trim() })
        })
        if (res.ok) {
          addToast('Cập nhật thiết bị thành công')
          fetchDevices()
          closeModal()
        } else {
          const err = await res.json().catch(()=>null)
          addToast(err?.detail || 'Lỗi cập nhật', 'error')
        }
      } else {
        // Create
        const res = await fetch('http://localhost:8000/api/devices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ device_id: deviceId.trim(), name: name.trim() })
        })
        if (res.ok) {
          addToast('Thêm thiết bị thành công')
          fetchDevices()
          closeModal()
        } else {
          const err = await res.json().catch(()=>null)
          addToast(err?.detail || 'Lỗi thêm mới', 'error')
        }
      }
    } catch (err) {
      addToast('Lỗi kết nối', 'error')
    }
  }

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa thiết bị ${name}?`)) return
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`http://localhost:8000/api/devices/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        addToast('Xóa thiết bị thành công')
        fetchDevices()
      } else {
        const err = await res.json().catch(()=>null)
        addToast(err?.detail || 'Lỗi xóa', 'error')
      }
    } catch (err) {
      addToast('Lỗi kết nối', 'error')
    }
  }

  return (
    <div className="students-page">
      <div className="page-header students-header">
        <div>
          <h1>Quản lý Thiết bị (ESP32)</h1>
          <p>Thêm, sửa, xóa và theo dõi trạng thái các thiết bị quét thẻ</p>
        </div>
        <button className="btn-add" onClick={() => openModal()}>
          <Plus size={18} /> Thêm Thiết bị
        </button>
      </div>

      <div className="table-card">
        {isLoading ? (
          <div className="loading-state">
            <Loader2 size={28} className="spin" />
            <span>Đang tải danh sách thiết bị...</span>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Device ID (Topic)</th>
                <th>Tên / Vị trí</th>
                <th>Trạng thái gán phòng</th>
                <th style={{ width: 120, textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d, i) => (
                <tr key={d.id}>
                  <td className="row-num">{i + 1}</td>
                  <td className="mssv-cell">{d.device_id}</td>
                  <td style={{ fontWeight: 500 }}>{d.name}</td>
                  <td>
                    {d.assigned_room_id ? (
                       <span style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>Đã gán (Room {d.assigned_room_id})</span>
                    ) : (
                       <span style={{ color: '#64748b', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>Trống</span>
                    )}
                  </td>
                  <td>
                    <div className="row-actions" style={{ justifyContent: 'center' }}>
                      <button className="icon-btn" onClick={() => openModal(d)} title="Sửa thiết bị">
                        <Edit2 size={16} />
                      </button>
                      <button className="icon-btn delete" onClick={() => handleDelete(d.id, d.name)} title="Xóa thiết bị">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {devices.length === 0 && (
                <tr>
                  <td colSpan="5" className="empty-state">
                    <Wifi size={40} />
                    <span>Chưa có thiết bị nào trong hệ thống.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingDevice ? 'Sửa Thiết bị' : 'Thêm Thiết bị mới'}</h2>
              <button type="button" className="modal-close" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="field-group">
                <label>Device ID (ESP32 MAC/ID)</label>
                <input 
                  type="text" 
                  placeholder="VD: ROOM_01" 
                  value={deviceId} 
                  onChange={e => setDeviceId(e.target.value)}
                  required
                  readOnly={!!editingDevice}
                />
              </div>
              <div className="field-group">
                <label>Tên Thiết bị (Vị trí)</label>
                <input 
                  type="text" 
                  placeholder="VD: Máy quét Cửa trước - D9-101" 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeModal}>Hủy</button>
                <button type="submit" className="btn-submit">{editingDevice ? 'Cập nhật' : 'Lưu lại'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}

export default DeviceManagementPage
