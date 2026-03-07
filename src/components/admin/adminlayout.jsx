import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/authcontext'
import {
  BookOpen, LayoutDashboard, BookCopy, ArrowLeftRight,
  Users, BarChart2, Trophy, LogOut, Menu, X, ChevronRight
} from 'lucide-react'
import toast from 'react-hot-toast'

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/admin/books', icon: BookCopy, label: 'Manajemen Buku' },
  { to: '/admin/transactions', icon: ArrowLeftRight, label: 'Peminjaman' },
  { to: '/admin/students', icon: Users, label: 'Data Siswa' },
  { to: '/admin/reports', icon: BarChart2, label: 'Laporan' },
  { to: '/admin/leaderboard', icon: Trophy, label: 'Leaderboard' },
]

export default function AdminLayout() {
  const { signOut, profile } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = async () => {
    await signOut()
    toast.success('Berhasil logout')
    navigate('/login')
  }

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px',
            background: 'var(--primary)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <BookOpen size={22} color="#1a1f0e" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>Perpustakaan</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Admin Panel</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', padding: '8px 8px 12px', textTransform: 'uppercase' }}>
          Menu
        </div>
        {navItems.map(({ to, icon: Icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            onClick={() => setSidebarOpen(false)}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '11px 12px',
              borderRadius: '10px',
              marginBottom: '3px',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: isActive ? 600 : 500,
              color: isActive ? '#1a1f0e' : 'rgba(255,255,255,0.6)',
              background: isActive ? 'var(--primary)' : 'transparent',
              transition: 'all 0.15s ease',
            })}
          >
            {({ isActive }) => (
              <>
                <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />
                <span style={{ flex: 1 }}>{label}</span>
                {isActive && <ChevronRight size={14} strokeWidth={2.5} />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Profile & Logout */}
      <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 12px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '10px',
          marginBottom: '8px',
        }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '50%',
            background: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1a1f0e' }}>
              {profile?.name?.charAt(0) || 'A'}
            </span>
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.name || 'Administrator'}
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>Admin Perpustakaan</div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '9px',
            padding: '10px 12px', borderRadius: '10px',
            background: 'rgba(239,68,68,0.1)', border: 'none',
            color: '#fca5a5', cursor: 'pointer',
            fontFamily: 'Poppins, sans-serif', fontSize: '13px', fontWeight: 500,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
        >
          <LogOut size={15} />
          Keluar
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-light)' }}>
      {/* Desktop Sidebar */}
      <aside style={{
        width: '240px', flexShrink: 0,
        background: '#1a1f0e',
        position: 'fixed', top: 0, left: 0, bottom: 0,
        zIndex: 100,
        display: 'flex', flexDirection: 'column',
      }} className="desktop-sidebar">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }}
          onClick={() => setSidebarOpen(false)}
        >
          <aside
            style={{
              width: '260px', height: '100%',
              background: '#1a1f0e',
              display: 'flex', flexDirection: 'column',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                position: 'absolute', top: '16px', right: '16px',
                background: 'rgba(255,255,255,0.1)', border: 'none',
                borderRadius: '8px', padding: '6px',
                color: 'white', cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main style={{ flex: 1, marginLeft: '240px', minWidth: 0 }} className="admin-main">
        {/* Mobile Header */}
        <div style={{
          display: 'none', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', background: 'white',
          borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, zIndex: 50,
        }} className="mobile-header">
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}
          >
            <Menu size={22} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px', height: '28px', background: 'var(--primary)',
              borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BookOpen size={16} color="#1a1f0e" />
            </div>
            <span style={{ fontWeight: 700, fontSize: '14px' }}>Perpustakaan</span>
          </div>
          <div style={{ width: '22px' }} />
        </div>

        <div style={{ padding: '28px' }}>
          <Outlet />
        </div>
      </main>

      <style>{`
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .admin-main { margin-left: 0 !important; }
          .mobile-header { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
