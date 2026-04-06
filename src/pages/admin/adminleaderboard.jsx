import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Trophy, Star, Medal, Crown, Award, BookOpen } from 'lucide-react'

const BADGE_LEVELS = [
  { min: 100, name: 'Gold Reader', emoji: '🥇', color: '#f59e0b', bg: '#fffbeb', label: 'Gold', border: '#fbbf24' },
  { min: 70, name: 'Silver Reader', emoji: '🥈', color: '#6b7280', bg: '#f9fafb', label: 'Silver', border: '#9ca3af' },
  { min: 40, name: 'Bronze Reader', emoji: '🥉', color: '#b45309', bg: '#fef3c7', label: 'Bronze', border: '#d97706' },
]

function getBadge(count) {
  return BADGE_LEVELS.find(b => count >= b.min) || null
}

function getNextBadge(count) {
  const levels = [...BADGE_LEVELS].reverse()
  return levels.find(b => b.min > count) || null
}

export default function AdminLeaderboard() {
  const [classData, setClassData] = useState([])
  const [topStudents, setTopStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('classes') // clases | studets

  useEffect(() => { fetchLeaderboardData() }, [])

  const fetchLeaderboardData = async () => {
    try {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

      // Class leaderboard
      const { data: classTxns } = await supabase
        .from('transactions')
        .select('class_id, classes(id, name, teacher)')
        .eq('status', 'returned')
        .gte('return_date', startOfMonth)

      const classMap = {}
      classTxns?.forEach(t => {
        const key = t.class_id
        if (!classMap[key]) classMap[key] = { ...t.classes, count: 0 }
        classMap[key].count++
      })
      const sorted = Object.values(classMap).sort((a, b) => b.count - a.count)
      setClassData(sorted)

      // Top students berdasarkan point
      const { data: pointsData } = await supabase
        .from('points_log')
        .select('student_id, points, students(name, nis, classes(name))')
        .gte('created_at', startOfMonth)

      const studentMap = {}
      pointsData?.forEach(p => {
        const key = p.student_id
        if (!studentMap[key]) studentMap[key] = {
          id: key, ...p.students, total: 0
        }
        studentMap[key].total += p.points
      })
      setTopStudents(Object.values(studentMap).sort((a, b) => b.total - a.total).slice(0, 10))

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const RankIcon = ({ rank }) => {
    if (rank === 1) return <Crown size={18} color="#f59e0b" />
    if (rank === 2) return <Medal size={16} color="#9ca3af" />
    if (rank === 3) return <Medal size={16} color="#d97706" />
    return <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)' }}>{rank}</span>
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Leaderboard & Gamifikasi</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })} — Target: 40 buku/kelas
        </p>
      </div>

      {/* Badge Legend */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {BADGE_LEVELS.map((b, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '12px 20px',
            background: b.bg,
            border: `1.5px solid ${b.border}`,
            borderRadius: 'var(--radius-md)',
            flex: '1 1 160px',
          }}>
            <span style={{ fontSize: '24px' }}>{b.emoji}</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: b.color }}>{b.label}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>≥ {b.min} buku</div>
            </div>
          </div>
        ))}
      </div>

      {/* View Toggle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {[
          { id: 'classes', label: '🏫 Ranking Kelas' },
          { id: 'students', label: '👤 Top Siswa' },
        ].map(v => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            style={{
              padding: '9px 18px',
              borderRadius: 'var(--radius-sm)',
              border: '1.5px solid',
              borderColor: view === v.id ? 'var(--primary)' : 'var(--border)',
              background: view === v.id ? 'var(--primary)' : 'white',
              color: view === v.id ? '#1a1f0e' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'Poppins, sans-serif',
              fontSize: '13px', fontWeight: 600,
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'classes' && (
        <div>
          {classData.length === 0 ? (
            <div className="card empty-state">
              <Trophy size={40} />
              <h3>Belum ada data bulan ini</h3>
              <p>Data akan muncul setelah ada peminjaman yang dikembalikan</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {classData.map((cls, idx) => {
                const badge = getBadge(cls.count)
                const next = getNextBadge(cls.count)
                const progress = next ? Math.min((cls.count / next.min) * 100, 100) : 100
                const rank = idx + 1

                return (
                  <div
                    key={cls.id}
                    className="card"
                    style={{
                      padding: '20px 24px',
                      border: rank === 1 ? '2px solid #f59e0b' : badge ? `1.5px solid ${badge.border}` : '1px solid var(--border-light)',
                      background: rank === 1 ? 'linear-gradient(135deg, #fffbeb 0%, #fff 100%)' : badge ? badge.bg : 'white',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {rank === 1 && (
                      <div style={{
                        position: 'absolute', top: 0, right: 0,
                        width: '80px', height: '80px',
                        background: 'rgba(251, 191, 36, 0.08)',
                        borderRadius: '0 0 0 80px',
                      }} />
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      {/* Rank */}
                      <div style={{
                        width: '44px', height: '44px', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: rank <= 3 ? 'rgba(255,255,255,0.8)' : 'var(--bg-light)',
                        borderRadius: '50%', border: '1px solid var(--border)',
                      }}>
                        <RankIcon rank={rank} />
                      </div>

                      {/* Class Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span style={{ fontSize: '16px', fontWeight: 700 }}>{cls.name}</span>
                          {badge && (
                            <span style={{
                              fontSize: '11px', fontWeight: 700,
                              padding: '3px 10px', borderRadius: '20px',
                              background: badge.bg, color: badge.color,
                              border: `1px solid ${badge.border}`,
                            }}>
                              {badge.emoji} {badge.label}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '8px', background: 'rgba(0,0,0,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${badge ? 100 : (cls.count / 40) * 100}%`,
                              background: badge ? badge.color : 'var(--primary)',
                              borderRadius: '4px',
                              transition: 'width 0.8s ease',
                            }} />
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>
                            {cls.count}/{badge ? badge.min : 40}
                          </span>
                        </div>

                        {!badge && next && (
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {next.min - cls.count} buku lagi untuk raih {next.emoji} {next.label}
                          </p>
                        )}
                        {cls.teacher && (
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Wali Kelas: {cls.teacher}
                          </p>
                        )}
                      </div>

                      {/* Count Display */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '28px', fontWeight: 800, color: badge ? badge.color : 'var(--text-primary)', lineHeight: 1 }}>
                          {cls.count}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>buku</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {view === 'students' && (
        <div className="card">
          {topStudents.length === 0 ? (
            <div className="empty-state">
              <Star size={36} />
              <h3>Belum ada data</h3>
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Peringkat</th>
                    <th>Siswa</th>
                    <th>Kelas</th>
                    <th>Total Poin</th>
                    <th>Level</th>
                  </tr>
                </thead>
                <tbody>
                  {topStudents.map((s, i) => (
                    <tr key={s.id}>
                      <td style={{ width: '60px', textAlign: 'center' }}>
                        <RankIcon rank={i + 1} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: i === 0 ? '#fef3c7' : i === 1 ? '#f3f4f6' : i === 2 ? '#fef3c7' : 'var(--primary-pale)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '13px', fontWeight: 700,
                            color: i === 0 ? '#f59e0b' : i === 1 ? '#6b7280' : i === 2 ? '#d97706' : 'var(--primary-dark)',
                          }}>
                            {s.name?.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '13px' }}>{s.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.nis}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: '13px' }}>{s.classes?.name || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Star size={13} color="#f59e0b" fill="#f59e0b" />
                          <span style={{ fontWeight: 700, fontSize: '14px' }}>{s.total}</span>
                        </div>
                      </td>
                      <td>
                        {s.total >= 50 ? (
                          <span style={{ background: '#fffbeb', color: '#d97706', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>⭐ Elite Reader</span>
                        ) : s.total >= 20 ? (
                          <span style={{ background: '#eff6ff', color: '#3b82f6', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>📚 Active Reader</span>
                        ) : (
                          <span style={{ background: 'var(--primary-pale)', color: 'var(--primary-dark)', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>🌱 Beginner</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
