import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/login-page'
import DashboardPage from './pages/dashboard-page'
import StudentManagementPage from './pages/student-management-page'
import AppLayout from './components/app-layout'

/**
 * Root application component.
 * Defines the route structure:
 *  - /login         → Login/Register page
 *  - /dashboard     → Dashboard with charts (inside layout)
 *  - /students      → Student CRUD management (inside layout)
 *  - /*             → Redirect to login
 */
function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/students" element={<StudentManagementPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
