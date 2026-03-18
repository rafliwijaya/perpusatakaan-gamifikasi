import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { BookOpen, User, Lock, Eye, EyeOff, Shield, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [loginType, setLoginType] = useState('student') // 'student' | 'admin'
  const [nis, setNis] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (loginType === 'student') {
        await handleStudentLogin()
      } else {
        await handleAdminLogin()
      }
    } catch (err) {
      toast.error('Terjadi kesalahan. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  const handleAdminLogin = async () => {
    const { error } = await signIn(email, password)
    if (error) {
      toast.error(
        error.message === 'Invalid login credentials'
          ? 'Email atau password salah'
          : error.message
      )
      return
    }
    toast.success('Login berhasil!')
    navigate('/admin')
  }

  const handleStudentLogin = async () => {
    const loginEmail = `${nis.trim()}@perpustakaan.sch.id`

    const { error } = await signIn(loginEmail, password)
    if (error) {
      if (error.message === 'Invalid login credentials') {
        toast.error('NIS atau password salah.')
      } else {
        toast.error(error.message)
      }
      return
    }

    toast.success('Selamat datang!')
    navigate('/home')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg-light)' }}>
      <div style={{
        flex: 1,
        background: 'linear-gradient(135deg, #1a1f0e 0%, #2d3a14 50%, #3d5019 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px',
        position: 'relative',
        overflow: 'hidden',
      }} className="login-left-panel">
        <div style={{
          position: 'absolute', top: '-80px', right: '-80px',
          width: '400px', height: '400px',
          background: 'rgba(135,219,32,0.08)',
          borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute', bottom: '-100px', left: '-60px',
          width: '300px', height: '300px',
          background: 'rgba(135,219,32,0.05)',
          borderRadius: '50%',
        }} />

        <div style={{
          position: 'absolute', top: '20%', right: '40px',
          display: 'flex', flexDirection: 'column', gap: '12px', opacity: 0.4,
        }}>
          {['#87DB20','#6ab818','#a8e84d'].map((c,i) => (
            <div key={i} style={{
              width: `${70 - i*10}px`, height: '8px',
              background: c, borderRadius: '4px',
            }} />
          ))}
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '48px' }}>
            <div style={{
              width: '52px', height: '52px',
              background: 'var(--primary)',
              borderRadius: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BookOpen size={28} color="#1a1f0e" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'white' }}>Perpustakaan</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '-2px' }}>Digital School Library</div>
            </div>
          </div>

          <h1 style={{
            fontSize: '42px', fontWeight: 800, color: 'white',
            lineHeight: 1.15, marginBottom: '20px',
          }}>
            Baca Lebih<br />
            <span style={{ color: 'var(--primary)' }}>Raih Lebih</span>
          </h1>

          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.55)', maxWidth: '340px', lineHeight: 1.7 }}>
            Platform perpustakaan digital dengan sistem gamifikasi. Kelas dengan bacaan terbanyak mendapat badge kehormatan.
          </p>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '32px', marginTop: '48px' }}>
            {[
              { label: 'Buku Tersedia', val: '1,200+' },
              { label: 'Badge Kelas', val: '3 Level' },
              { label: 'Target/Bulan', val: '40 Buku' },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--primary)' }}>{s.val}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{
        width: '480px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        background: 'white',
      }}>
        <div style={{ width: '100%', maxWidth: '380px', animation: 'fadeIn 0.4s ease' }}>
          <h2 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Selamat Datang
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '32px' }}>
            Pilih tipe akun dan masukkan kredensial kamu
          </p>

          <div style={{
            display: 'flex', gap: '0',
            background: 'var(--bg-light)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px',
            marginBottom: '28px',
          }}>
            {[
              { id: 'student', label: 'Siswa', icon: User },
              { id: 'admin', label: 'Admin', icon: Shield },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setLoginType(id)}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                  padding: '10px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '13px',
                  fontWeight: loginType === id ? 600 : 500,
                  background: loginType === id ? 'white' : 'transparent',
                  color: loginType === id ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: loginType === id ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {loginType === 'student' ? (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  NIS (Nomor Induk Siswa)
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{
                    position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }} />
                  <input
                    className="input"
                    style={{ paddingLeft: '42px' }}
                    type="text"
                    placeholder="Masukkan NIS kamu"
                    value={nis}
                    onChange={(e) => setNis(e.target.value)}
                    required
                  />
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Contoh: 2024001
                </p>
              </div>
            ) : (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Email Admin
                </label>
                <div style={{ position: 'relative' }}>
                  <Shield size={16} style={{
                    position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }} />
                  <input
                    className="input"
                    style={{ paddingLeft: '42px' }}
                    type="email"
                    placeholder="admin@perpustakaan.sch.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{
                  position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }} />
                <input
                  className="input"
                  style={{ paddingLeft: '42px', paddingRight: '44px' }}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: '4px',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                  Masuk...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Masuk
                  <ChevronRight size={17} />
                </span>
              )}
            </button>
          </form>

          {loginType === 'student' && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>
              Lupa password? Hubungi guru atau admin perpustakaan.
            </p>
          )}

          <div style={{
            marginTop: '40px', paddingTop: '24px',
            borderTop: '1px solid var(--border-light)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary-light)', opacity: 0.6 }} />
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--primary-pale)', opacity: 0.8 }} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>
              Perpustakaan Digital © {new Date().getFullYear()}
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .login-left-panel { display: none !important; }
        }
      `}</style>
    </div>
  )
}
