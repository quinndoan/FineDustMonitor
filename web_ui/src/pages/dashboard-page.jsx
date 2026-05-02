import { useState, useEffect } from 'react'
import { Users, Cpu, ScanLine, DoorOpen, Loader2, RefreshCw, Clock } from 'lucide-react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend,
} from 'recharts'
import { useAuth } from '../contexts/auth-context'
import './dashboard-page.css'

const API_URL = 'http://localhost:8000/api/dashboard/stats'

/* Shared tooltip style */
const tooltipStyle = {
  background: '#1e293b',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  color: '#f1f5f9',
  fontSize: '0.8rem',
}

/* Custom pie chart label */
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent === 0) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { token } = useAuth()

  const fetchStats = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Không thể tải dữ liệu dashboard.')
      const data = await res.json()
      setStats(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    // Auto-refresh every 30s
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !stats) {
    return (
      <div className="dashboard-loading">
        <Loader2 size={32} className="spin" />
        <p>Đang tải dữ liệu...</p>
      </div>
    )
  }

  if (error && !stats) {
    return (
      <div className="dashboard-error">
        <p>{error}</p>
        <button onClick={fetchStats} className="retry-btn">Thử lại</button>
      </div>
    )
  }

  const {
    total_students = 0,
    total_devices = 0,
    total_exam_rooms = 0,
    today_scans_total = 0,
    today_scans_accepted = 0,
    today_scans_denied = 0,
    today_scan_pie = [],
    students_by_faculty = [],
    weekly_activity = [],
    scan_by_type = {},
    recent_scans = [],
  } = stats || {}

  const statCards = [
    { label: 'Tổng sinh viên', value: total_students, icon: Users, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
    { label: 'Thiết bị ESP32', value: total_devices, icon: Cpu, color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    { label: 'Phòng thi', value: total_exam_rooms, icon: DoorOpen, color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
    { label: 'Lượt quét hôm nay', value: today_scans_total, icon: ScanLine, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  ]

  // If pie chart has all zeros, show placeholder
  const hasPieData = today_scan_pie.some(d => d.value > 0)

  // Faculty bar chart colors
  const facultyColors = [
    '#6366f1', '#8b5cf6', '#a78bfa', '#3b82f6', '#60a5fa',
    '#10b981', '#34d399', '#f59e0b', '#f97316', '#ef4444',
    '#ec4899', '#14b8a6', '#06b6d4',
  ]

  return (
    <div className="dashboard">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Dashboard</h1>
          <p>Tổng quan hệ thống giám sát</p>
        </div>
        <button className="refresh-btn" onClick={fetchStats} title="Tải lại dữ liệu">
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          Làm mới
        </button>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        {statCards.map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-icon" style={{ background: s.bg, color: s.color }}>
              <s.icon size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Pie Chart – Today's scan results */}
        <div className="chart-card">
          <h3>Kết quả quét thẻ hôm nay</h3>
          {hasPieData ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={today_scan_pie}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={85}
                    dataKey="value"
                    paddingAngle={4}
                    labelLine={false}
                    label={renderCustomLabel}
                  >
                    {today_scan_pie.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pie-legend">
                {today_scan_pie.map((s, i) => (
                  <div key={i} className="legend-item">
                    <span className="legend-dot" style={{ background: s.color }} />
                    <span>{s.name}: <strong>{s.value}</strong></span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="chart-empty">
              <ScanLine size={40} />
              <p>Chưa có lượt quét nào hôm nay</p>
            </div>
          )}
        </div>

        {/* Bar Chart – Students by Faculty */}
        <div className="chart-card">
          <h3>Sinh viên theo trường - viện</h3>
          {students_by_faculty.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={students_by_faculty} margin={{ bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="name"
                  stroke="#64748b"
                  fontSize={11}
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                  height={60}
                />
                <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name, props) => [value, 'Sinh viên']}
                  labelFormatter={(label) => {
                    const item = students_by_faculty.find(f => f.name === label)
                    return item?.full_name || label
                  }}
                />
                <Bar dataKey="students" radius={[6, 6, 0, 0]}>
                  {students_by_faculty.map((_, idx) => (
                    <Cell key={idx} fill={facultyColors[idx % facultyColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">
              <Users size={40} />
              <p>Chưa có dữ liệu sinh viên</p>
            </div>
          )}
        </div>

        {/* Area Chart – Weekly scan activity */}
        <div className="chart-card chart-wide">
          <h3>Hoạt động quét thẻ 7 ngày gần nhất</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={weekly_activity}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, 'Lượt quét']} />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#6366f1"
                fill="url(#areaGrad)"
                strokeWidth={2.5}
                dot={{ fill: '#6366f1', r: 4 }}
                activeDot={{ r: 6, stroke: '#818cf8', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scan type badges + recent scans */}
      <div className="bottom-section">
        {/* Scan type breakdown */}
        <div className="scan-type-card">
          <h3>Loại quét hôm nay</h3>
          <div className="scan-type-badges">
            <div className="scan-badge rfid">
              <span className="badge-label">RFID / NFC</span>
              <span className="badge-value">{(scan_by_type.rfid || 0) + (scan_by_type.nfc || 0)}</span>
            </div>
            <div className="scan-badge qr">
              <span className="badge-label">QR Code</span>
              <span className="badge-value">{scan_by_type.qr || 0}</span>
            </div>
          </div>
        </div>

        {/* Recent scans table */}
        <div className="recent-scans-card">
          <h3>Lượt quét gần đây</h3>
          {recent_scans.length > 0 ? (
            <div className="recent-table-wrapper">
              <table className="recent-table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Loại</th>
                    <th>MSSV</th>
                    <th>Tên SV</th>
                    <th>Kết quả</th>
                  </tr>
                </thead>
                <tbody>
                  {recent_scans.map((s) => (
                    <tr key={s.id}>
                      <td className="time-cell">
                        <Clock size={13} />
                        {s.scanned_at ? new Date(s.scanned_at).toLocaleString('vi-VN', {
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                          day: '2-digit', month: '2-digit',
                        }) : '—'}
                      </td>
                      <td>
                        <span className={`type-tag ${s.scan_type}`}>
                          {s.scan_type?.toUpperCase()}
                        </span>
                      </td>
                      <td>{s.student_mssv || '—'}</td>
                      <td>{s.student_name || '—'}</td>
                      <td>
                        <span className={`result-tag ${s.result}`}>
                          {s.result === 'accepted' ? '✓ Chấp nhận' : '✗ Từ chối'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="chart-empty small">
              <ScanLine size={28} />
              <p>Chưa có lượt quét nào</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
