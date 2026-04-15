// GURU LAYOUT

import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/authcontext'
import { BookOpen, Home, Clock, User, LogOut, Menu, X } from 'lucide-react'
import toast from 'react-hot-toast'

const navItems = [
  { to: '/guru', icon: Home, label: 'Beranda', exact: true },
  { to: '/guru/history', icon: Clock, label: 'Riwayat' },
  { to: '/guru/profile', icon: User, label: 'Profil' },
]

export default function GuruLayout() {
  const { signOut, profile } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await signOut()
    toast.success('Berhasil logout')
    navigate('/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-light)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <header style={{
        background: 'white',
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
      }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
          {/* Logo */}
          <NavLink to="/guru" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <div style={{
              width: '34px', height: '34px', background: 'var(--primary)',
              borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BookOpen size={18} color="#1a1f0e" strokeWidth={2.5} />
            </div>
            <div>
              <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>Perpustakaan</span>
              <span style={{
                marginLeft: '8px', fontSize: '10px', fontWeight: 700,
                background: '#eff6ff', color: '#3b82f6',
                padding: '2px 8px', borderRadius: '20px',
              }}>GURU</span>
            </div>
          </NavLink>

          {/* Desktop Nav */}
          <nav style={{ display: 'flex', gap: '4px' }} className="desktop-nav">
            {navItems.map(({ to, icon: Icon, label, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px', borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: '13px', fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--primary-dark)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--primary-pale)' : 'transparent',
                  transition: 'all 0.15s',
                })}
              >
                <Icon size={15} /> {label}
              </NavLink>
            ))}
          </nav>

          {/* Right Side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '5px 12px 5px 5px',
              background: 'var(--bg-light)',
              borderRadius: '999px',
              border: '1px solid var(--border)',
            }} className="user-chip">
              <div style={{
                width: '26px', height: '26px', borderRadius: '50%',
                background: '#3b82f6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700, color: 'white',
              }}>
                {profile?.name?.charAt(0) || 'G'}
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {profile?.name?.split(' ').slice(0, 2).join(' ') || 'Guru'}
              </span>
            </div>

            <button
              onClick={handleLogout}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '6px', borderRadius: '8px' }}
              title="Keluar"
            >
              <LogOut size={16} />
            </button>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}
              className="mobile-menu-btn"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '12px 20px 16px', background: 'white' }}>
            {navItems.map(({ to, icon: Icon, label, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                onClick={() => setMenuOpen(false)}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '11px 14px', borderRadius: '8px', marginBottom: '4px',
                  textDecoration: 'none',
                  fontSize: '14px', fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--primary-dark)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--primary-pale)' : 'transparent',
                })}
              >
                <Icon size={16} /> {label}
              </NavLink>
            ))}
          </div>
        )}
      </header>

      <main style={{ flex: 1, padding: '24px 0' }}>
        <div className="container">
          <Outlet />
        </div>
      </main>

      <style>{`
        @media (max-width: 640px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
          .user-chip { display: none !important; }
        }
      `}</style>
    </div>
  )
}
