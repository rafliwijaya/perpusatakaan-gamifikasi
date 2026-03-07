import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'

// pages
import LoginPage from './pages/LoginPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminBooks from './pages/admin/AdminBooks'
import AdminTransactions from './pages/admin/AdminTransactions'
import AdminStudents from './pages/admin/AdminStudents'
import AdminReports from './pages/admin/AdminReports'
import AdminLeaderboard from './pages/admin/AdminLeaderboard'

import StudentHome from './pages/student/StudentHome'
import StudentBorrow from './pages/student/StudentBorrow'
import StudentHistory from './pages/student/StudentHistory'
import StudentProfile from './pages/student/StudentProfile'

// layouts
import AdminLayout from './components/admin/AdminLayout'
import StudentLayout from './components/student/StudentLayout'

function ProtectedRoute({ children, requiredRole }) {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (requiredRole && role !== requiredRole) {
    return <Navigate to={role === 'admin' ? '/admin' : '/home'} replace />
  }

  return children
}

function RootRedirect() {
  const { user, role, loading } = useAuth()

  if (loading) return (
    <div className="page-loader">
      <div className="spinner" />
    </div>
  )

  if (!user) return <Navigate to="/login" replace />
  if (role === 'admin') return <Navigate to="/admin" replace />
  return <Navigate to="/home" replace />
}

function AppRoutes() {
  return (
    <Routes>
      {/* Root */}
      <Route path="/" element={<RootRedirect />} />

      {/* Login */}
      <Route path="/login" element={<LoginPage />} />

      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute requiredRole="admin">
          <AdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="books" element={<AdminBooks />} />
        <Route path="transactions" element={<AdminTransactions />} />
        <Route path="students" element={<AdminStudents />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="leaderboard" element={<AdminLeaderboard />} />
      </Route>

      {/* Student Routes */}
      <Route path="/home" element={
        <ProtectedRoute requiredRole="student">
          <StudentLayout />
        </ProtectedRoute>
      }>
        <Route index element={<StudentHome />} />
        <Route path="borrow" element={<StudentBorrow />} />
        <Route path="history" element={<StudentHistory />} />
        <Route path="profile" element={<StudentProfile />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              fontFamily: 'Poppins, sans-serif',
              fontSize: '13px',
              borderRadius: '10px',
              border: '1px solid #e8edf0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            },
            success: {
              iconTheme: { primary: '#87DB20', secondary: '#fff' }
            }
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  )
}