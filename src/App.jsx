// APP.JSX

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

// Guru
import GuruLayout from './components/guru/gurulayout'
import GuruHome from './pages/guru/guruhome'
import GuruHistory from './pages/guru/guruhistory'
import GuruProfile from './pages/guru/guruprofile'

function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAdmin, isStudent, isGuru, loading } = useAuth()

  if (loading) return (
    <div className="page-loader"><div className="spinner" /></div>
  )

  if (!user) return <Navigate to="/login" replace />

  if (allowedRoles.includes('admin') && !isAdmin) {
    return <Navigate to={isGuru ? '/guru' : '/home'} replace />
  }
  if (allowedRoles.includes('student') && !isStudent) {
    return <Navigate to={isAdmin ? '/admin' : isGuru ? '/guru' : '/login'} replace />
  }
  if (allowedRoles.includes('guru') && !isGuru) {
    return <Navigate to={isAdmin ? '/admin' : isStudent ? '/home' : '/login'} replace />
  }

  return children
}

function RootRedirect() {
  const { user, isAdmin, isGuru, loading } = useAuth()

  if (loading) return (
    <div className="page-loader"><div className="spinner" /></div>
  )

  if (!user) return <Navigate to="/login" replace />
  if (isAdmin) return <Navigate to="/admin" replace />
  if (isGuru) return <Navigate to="/guru" replace />
  return <Navigate to="/home" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Admin */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin']}>
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

      {/* Student */}
      <Route path="/home" element={
        <ProtectedRoute allowedRoles={['student']}>
          <StudentLayout />
        </ProtectedRoute>
      }>
        <Route index element={<StudentHome />} />
        <Route path="borrow" element={<StudentBorrow />} />
        <Route path="history" element={<StudentHistory />} />
        <Route path="profile" element={<StudentProfile />} />
      </Route>

      {/* Guru */}
      <Route path="/guru" element={
        <ProtectedRoute allowedRoles={['guru']}>
          <GuruLayout />
        </ProtectedRoute>
      }>
        <Route index element={<GuruHome />} />
        <Route path="history" element={<GuruHistory />} />
        <Route path="profile" element={<GuruProfile />} />
      </Route>

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
            success: { iconTheme: { primary: '#87DB20', secondary: '#fff' } }
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  )
}
