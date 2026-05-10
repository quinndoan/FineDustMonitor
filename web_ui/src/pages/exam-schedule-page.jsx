import { useState, useEffect } from 'react'
import { Calendar, Loader2, DoorOpen, Clock } from 'lucide-react'
import './student-management-page.css' // Reuse styles
import './exam-schedule-page.css'

const API_URL = 'http://localhost:8000/api/exam-rooms'

function ExamSchedulePage() {
  const [rooms, setRooms] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    fetchRooms(filterDate)
  }, [filterDate])

  const fetchRooms = async (date) => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')
      const url = date ? `${API_URL}?date_filter=${date}` : API_URL
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) setRooms(await res.json())
    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="students-page schedule-page">
      <div className="page-header students-header">
        <div>
          <h1>Lịch thi</h1>
          <p>Xem danh sách các lớp thi theo ngày</p>
        </div>
      </div>

      <div className="search-bar schedule-filter">
        <Calendar size={18} className="search-icon" style={{color: '#6366f1'}} />
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="date-filter"
        />
        <button className="btn-clear" onClick={() => setFilterDate('')}>
          Xem tất cả
        </button>
      </div>

      <div className="schedule-grid">
        {isLoading ? (
          <div className="loading-state" style={{gridColumn: '1 / -1'}}>
            <Loader2 size={28} className="spin" />
            <span>Đang tải lịch thi...</span>
          </div>
        ) : rooms.length === 0 ? (
          <div className="empty-state" style={{gridColumn: '1 / -1', padding: '4rem'}}>
            <DoorOpen size={48} style={{opacity: 0.5, marginBottom: '1rem'}} />
            <h3>Không có lớp thi nào</h3>
            <p style={{color: '#64748b'}}>Không tìm thấy lớp thi nào cho ngày đã chọn.</p>
          </div>
        ) : (
          rooms.map((r) => (
            <div key={r.id} className="schedule-card">
              <div className="card-header">
                <h3 className="room-name">{r.room_name}</h3>
                <span className="exam-date">{new Date(r.exam_date).toLocaleDateString('vi-VN')}</span>
              </div>
              <div className="card-body">
                <p className="subject">{r.subject}</p>
                <div className="time-range">
                  <Clock size={16} />
                  {r.start_time.slice(0, 5)} - {r.end_time.slice(0, 5)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default ExamSchedulePage
