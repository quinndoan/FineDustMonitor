import { useState, useEffect } from 'react'
import { Users, CreditCard, UserPlus, Activity } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts'
import './dashboard-page.css'

const API_URL = 'http://localhost:8000/api/students'

/* Demo data for charts */
const monthlyData = [
  { name: 'T1', value: 12 }, { name: 'T2', value: 19 },
  { name: 'T3', value: 15 }, { name: 'T4', value: 25 },
  { name: 'T5', value: 22 }, { name: 'T6', value: 30 },
]

const departmentData = [
  { name: 'CNTT', students: 45 },
  { name: 'Điện tử', students: 32 },
  { name: 'Cơ khí', students: 28 },
  { name: 'Hóa học', students: 18 },
  { name: 'Kinh tế', students: 35 },
]

const rfidStatusData = [
  { name: 'Đã kích hoạt', value: 68, color: '#10b981' },
  { name: 'Chưa kích hoạt', value: 24, color: '#f59e0b' },
  { name: 'Hết hạn', value: 8, color: '#ef4444' },
]

const weeklyActivity = [
  { name: 'T2', check: 85 }, { name: 'T3', check: 72 },
  { name: 'T4', check: 91 }, { name: 'T5', check: 78 },
  { name: 'T6', check: 95 }, { name: 'T7', check: 60 },
  { name: 'CN', check: 40 },
]

/* Shared tooltip style */
const tooltipStyle = {
  background: '#1e293b',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  color: '#f1f5f9',
}

function DashboardPage() {
  const [studentCount, setStudentCount] = useState(0)

  useEffect(() => {
    fetch(API_URL)
      .then(res => res.json())
      .then(data => setStudentCount(data.length))
      .catch(() => setStudentCount(0))
  }, [])

  const stats = [
    { label: 'Tổng sinh viên', value: studentCount, icon: Users, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    { label: 'Thẻ RFID hoạt động', value: Math.floor(studentCount * 0.68), icon: CreditCard, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    { label: 'Đăng ký mới', value: Math.max(3, Math.floor(studentCount * 0.15)), icon: UserPlus, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
    { label: 'Lượt quét hôm nay', value: 42, icon: Activity, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  ]

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Tổng quan hệ thống giám sát</p>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        {stats.map((s, i) => (
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
        {/* Area Chart – Monthly Registrations */}
        <div className="chart-card">
          <h3>Đăng ký theo tháng</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="value" stroke="#6366f1" fill="url(#areaGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart – Students by Department */}
        <div className="chart-card">
          <h3>Sinh viên theo khoa</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={departmentData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="students" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart – RFID Status */}
        <div className="chart-card">
          <h3>Trạng thái thẻ RFID</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={rfidStatusData}
                cx="50%" cy="50%"
                innerRadius={55} outerRadius={80}
                dataKey="value"
                paddingAngle={5}
              >
                {rfidStatusData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pie-legend">
            {rfidStatusData.map((s, i) => (
              <div key={i} className="legend-item">
                <span className="legend-dot" style={{ background: s.color }} />
                <span>{s.name}: {s.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Line Chart – Weekly Scan Activity */}
        <div className="chart-card">
          <h3>Hoạt động quét thẻ trong tuần</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weeklyActivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone" dataKey="check" stroke="#10b981" strokeWidth={2}
                dot={{ fill: '#10b981', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
