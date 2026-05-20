import { useState, useEffect, useRef, useCallback } from 'react'
import { Users, Cpu, ScanLine, DoorOpen, Loader2, RefreshCw, Clock } from 'lucide-react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LabelList,
} from 'recharts'
import { useAuth } from '../contexts/auth-context'
import { API_BASE_URL, WS_BASE_URL } from '../config'
import './dashboard-page.css'

const API_URL = `${API_BASE_URL}/api/dashboard/stats`
const WS_URL = `${WS_BASE_URL}/api/dashboard/ws`

/* Shared tooltip style */
const tooltipStyle = {
  background: '#1e293b',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  color: '#f1f5f9',
  fontSize: '0.8rem',
  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
}

/* Custom pie chart label — percentage on arc */
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent === 0) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight={700}
      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

/* Center text for donut chart */
function PieCenterLabel({ viewBox, total }) {
  const { cx, cy } = viewBox
  return (
    <g>
      <text x={cx} y={cy - 6} textAnchor="middle" fill="#f1f5f9" fontSize={28} fontWeight={800}
        style={{ fontVariantNumeric: 'tabular-nums' }}>
        {total}
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" fill="#64748b" fontSize={11} fontWeight={500}>
        Lượt quét
      </text>
    </g>
  )
}

/* Cohesive pie chart colors */
const PIE_COLORS = ['#818cf8', '#fb7185']

/** Count-up animation hook */
function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0)
  const prevRef = useRef(0)

  useEffect(() => {
    const start = prevRef.current
    const end = typeof target === 'number' ? target : 0
    if (start === end) return
    const startTime = performance.now()

    const animate = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(start + (end - start) * eased)
      setValue(current)
      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        prevRef.current = end
      }
    }

    requestAnimationFrame(animate)
  }, [target, duration])

  return value
}

/** Skeleton Loading Component */
function DashboardSkeleton() {
  return (
    <div className="dashboard">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Dashboard</h1>
          <p>Tổng quan hệ thống giám sát</p>
        </div>
      </div>
      <div className="skeleton-stats-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton skeleton-stat-card" />
        ))}
      </div>
      <div className="skeleton-charts-grid">
        <div className="skeleton skeleton-chart" />
        <div className="skeleton skeleton-chart" />
        <div className="skeleton skeleton-chart-wide" />
      </div>
      <div className="skeleton-bottom">
        <div className="skeleton skeleton-scan-type" />
        <div className="skeleton skeleton-recent" />
      </div>
    </div>
  )
}

/** Animated Stat Value */
function AnimatedValue({ value }) {
  const animated = useCountUp(value)
  return <span className="stat-value">{animated}</span>
}

function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { token } = useAuth()
  const wsRef = useRef(null)

  const fetchStats = useCallback(async () => {
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
  }, [token])

  useEffect(() => {
    fetchStats()
    // Fallback: auto-refresh every 30s
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [fetchStats])

  // WebSocket for real-time updates
  useEffect(() => {
    let ws = null
    let reconnectTimer = null

    const connect = () => {
      ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[Dashboard WS] Connected')
      }

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data)
          if (msg.event === 'new_scan') {
            // Immediately refresh dashboard data
            fetchStats()
          }
        } catch (e) {
          // ignore parse errors
        }
      }

      ws.onclose = () => {
        console.log('[Dashboard WS] Disconnected, reconnecting in 3s...')
        reconnectTimer = setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (ws) {
        ws.onclose = null // prevent reconnect on intentional close
        ws.close()
      }
    }
  }, [fetchStats])

  // Skeleton loading state
  if (loading && !stats) {
    return <DashboardSkeleton />
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

  // Override pie colors with cohesive palette
  const styledPieData = today_scan_pie.map((d, i) => ({
    ...d,
    color: PIE_COLORS[i] || d.color,
  }))

  // Faculty bar chart — gradient indigo palette
  const facultyGradientColors = [
    '#6366f1', '#7c3aed', '#8b5cf6', '#a78bfa', '#818cf8',
    '#6d28d9', '#4f46e5', '#7e22ce', '#6366f1', '#8b5cf6',
  ]

  // Calculate scan type totals for progress bar
  const rfidTotal = (scan_by_type.rfid || 0) + (scan_by_type.nfc || 0)
  const qrTotal = scan_by_type.qr || 0
  const scanTotal = rfidTotal + qrTotal || 1 // avoid div-by-zero

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

      {/* Stat Cards with count-up animation */}
      <div className="stats-grid">
        {statCards.map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-icon" style={{ background: s.bg, color: s.color }}>
              <s.icon size={22} />
            </div>
            <div className="stat-info">
              <AnimatedValue value={s.value} />
              <span className="stat-label">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Pie Chart – Today's scan results */}
        <div className="chart-card pie-chart-card">
          <h3>Kết quả quét thẻ hôm nay</h3>
          {hasPieData ? (
            <div className="pie-chart-layout">
              <div className="pie-chart-wrapper">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={styledPieData}
                      cx="50%" cy="50%"
                      innerRadius={62} outerRadius={90}
                      dataKey="value"
                      paddingAngle={3}
                      labelLine={false}
                      label={renderCustomLabel}
                      animationBegin={0}
                      animationDuration={800}
                      strokeWidth={0}
                    >
                      {styledPieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    {/* Center total label */}
                    <Pie data={[{ value: 1 }]} cx="50%" cy="50%" innerRadius={0} outerRadius={0} dataKey="value">
                      <Cell fill="transparent" />
                      <LabelList content={<PieCenterLabel total={today_scans_total} />} />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="pie-legend-cards">
                {styledPieData.map((s, i) => (
                  <div key={i} className="legend-card" style={{ '--legend-color': s.color }}>
                    <div className="legend-card-dot" style={{ background: s.color }} />
                    <div className="legend-card-info">
                      <span className="legend-card-value">{s.value}</span>
                      <span className="legend-card-name">{s.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="chart-empty">
              <ScanLine size={40} />
              <p>Chưa có lượt quét nào hôm nay</p>
            </div>
          )}
        </div>

        {/* Horizontal Bar Chart – Students by Faculty */}
        <div className="chart-card faculty-chart-card">
          <h3>Sinh viên theo trường - viện</h3>
          {students_by_faculty.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, students_by_faculty.length * 48 + 20)}>
              <BarChart
                data={students_by_faculty}
                layout="vertical"
                margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="barHorizGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.95} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" stroke="#475569" fontSize={11} allowDecimals={false} axisLine={false} tickLine={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={110}
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [value, 'Sinh viên']}
                  labelFormatter={(label) => {
                    const item = students_by_faculty.find(f => f.name === label)
                    return item?.full_name || label
                  }}
                  cursor={{ fill: 'rgba(99, 102, 241, 0.06)' }}
                />
                <Bar
                  dataKey="students"
                  fill="url(#barHorizGrad)"
                  radius={[0, 6, 6, 0]}
                  animationDuration={1000}
                  barSize={24}
                >
                  <LabelList
                    dataKey="students"
                    position="right"
                    fill="#c4b5fd"
                    fontSize={13}
                    fontWeight={700}
                    offset={8}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  />
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
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v) => [v, 'Lượt quét']}
                cursor={{ stroke: 'rgba(99, 102, 241, 0.3)' }}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#6366f1"
                fill="url(#areaGrad)"
                strokeWidth={2.5}
                dot={{ fill: '#6366f1', r: 4, strokeWidth: 2, stroke: '#1e1b4b' }}
                activeDot={{ r: 7, stroke: '#818cf8', strokeWidth: 2, fill: '#6366f1' }}
                animationDuration={1200}
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
              <div>
                <div className="badge-left">
                  <span className="badge-icon">💳</span>
                  <span className="badge-label">RFID / NFC</span>
                </div>
                <div className="badge-progress">
                  <div
                    className="badge-progress-fill"
                    style={{ width: `${(rfidTotal / scanTotal) * 100}%` }}
                  />
                </div>
              </div>
              <span className="badge-value">{rfidTotal}</span>
            </div>
            <div className="scan-badge qr">
              <div>
                <div className="badge-left">
                  <span className="badge-icon">📱</span>
                  <span className="badge-label">QR Code</span>
                </div>
                <div className="badge-progress">
                  <div
                    className="badge-progress-fill"
                    style={{ width: `${(qrTotal / scanTotal) * 100}%` }}
                  />
                </div>
              </div>
              <span className="badge-value">{qrTotal}</span>
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
                          {s.scan_type === 'qr' ? '📱 ' : '💳 '}
                          {s.scan_type?.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                        {s.student_mssv || '—'}
                      </td>
                      <td>{s.student_name || '—'}</td>
                      <td>
                        <span className={`result-tag ${s.result}`}>
                          <span className="result-dot" />
                          {s.result === 'accepted' ? 'Chấp nhận' : 'Từ chối'}
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
