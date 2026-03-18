import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/authcontext'

// Pages
import LoginPage from './pages/login'
import AdminDashboard from './pages/admin/admindashboard'
import AdminBooks from './pages/admin/adminbooks'
import AdminTransactions from './pages/admin/admintrasactions'
import AdminStudents from './pages/admin/adminstudent'
import AdminReports from './pages/admin/adminreport'
import AdminLeaderboard from './pages/admin/adminleaderboard'

import StudentHome from './pages/student/studenthome'
import StudentBorrow from './pages/student/studentborrow'
import StudentHistory from './pages/student/studenthistory'
import StudentProfile from './pages/student/studentprofil'

// Layouts
import AdminLayout from './components/admin/adminlayout'
import StudentLayout from './components/student/studentlayout'

function ProtectedRoute({ children, requiredRole }) {
  const { user, isAdmin, isStudent, loading } = useAuth()

  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (requiredRole === 'admin' && !isAdmin) {
    return <Navigate to="/home" replace />
  }
  if (requiredRole === 'student' && !isStudent) {
    return <Navigate to="/admin" replace />
  }

  return children
}

function RootRedirect() {
  const { user, isAdmin, loading } = useAuth()

  if (loading) return (
    <div className="page-loader">
      <div className="spinner" />
    </div>
  )

  if (!user) return <Navigate to="/login" replace />
  if (isAdmin) return <Navigate to="/admin" replace />
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
