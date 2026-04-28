import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/auth-context'
import LoginPage from './pages/login-page'
import DashboardPage from './pages/dashboard-page'
import StudentManagementPage from './pages/student-management-page'
import ExamRoomManagementPage from './pages/exam-room-management-page'
import ExamRoomDetailPage from './pages/exam-room-detail-page'
import ExamSchedulePage from './pages/exam-schedule-page'
import DeviceManagementPage from './pages/device-management-page'
import AppLayout from './components/app-layout'

/**
 * Route guard: redirects to /login if user is not authenticated.
 */
function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', color: '#64748b', fontSize: '1rem',
      }}>
        Đang kiểm tra đăng nhập...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

/**
 * Root application component.
 * Wraps everything in AuthProvider. Protected routes require JWT auth.
 */
function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/students" element={<StudentManagementPage />} />
          <Route path="/exam-rooms" element={<ExamRoomManagementPage />} />
          <Route path="/exam-rooms/:roomId" element={<ExamRoomDetailPage />} />
          <Route path="/schedule" element={<ExamSchedulePage />} />
          <Route path="/devices" element={<DeviceManagementPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
