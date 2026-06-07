import { useState, useEffect, cloneElement } from 'react'
import { supabase } from '../../lib/supabase'
import { Trophy, Star, Medal, Crown, CircleStar, Sparkles, School } from 'lucide-react'

const CLASS_BADGE_LEVELS = [
  {
    min: 5.0001,
    name: 'Bintang Perpustakaan',
    emoji: <Sparkles />,
    color: '#f59e0b',
    bg: '#fffbeb',
    border: '#fbbf24',
    label: '> 5',
  },
  {
    min: 2,
    name: 'Sahabat Buku',
    emoji: <Medal />,
    color: '#6b7280',
    bg: '#f9fafb',
    border: '#9ca3af',
    label: '2 - 5',
  },
  {
    min: 0,
    name: 'Pemula Membaca',
    emoji: <CircleStar />,
    color: '#b45309',
    bg: '#fef3c7',
    border: '#d97706',
    label: '< 2',
  },
]

function getBadge(score) {
  return CLASS_BADGE_LEVELS.find(b => score >= b.min) || CLASS_BADGE_LEVELS[2]
}

function formatScore(score) {
  return Number(score || 0).toFixed(1)
}

export default function AdminLeaderboard() {
  const [classData, setClassData] = useState([])
  const [topStudents, setTopStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('classes') // classes | students

  useEffect(() => {
    fetchLeaderboardData()
  }, [])

  const fetchLeaderboardData = async () => {
    try {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

      const [classesRes, txnsRes, studentsRes] = await Promise.all([
        supabase.from('classes').select('id, name, teacher'),
        supabase
          .from('transactions')
          .select('class_id')
          .eq('status', 'returned')
          .gte('return_date', startOfMonth),
        supabase.from('students').select('id, class_id'),
      ])

      const classesData = classesRes.data || []
      const classTxns = txnsRes.data || []
      const studentsData = studentsRes.data || []

      const studentCountMap = {}
      studentsData.forEach(s => {
        if (s.class_id != null) {
          studentCountMap[s.class_id] = (studentCountMap[s.class_id] || 0) + 1
        }
      })

      const txnCountMap = {}
      classTxns.forEach(t => {
        if (t.class_id != null) {
          txnCountMap[t.class_id] = (txnCountMap[t.class_id] || 0) + 1
        }
      })

      const rankedClasses = classesData
        .map(cls => {
          const returnedCount = txnCountMap[cls.id] || 0
          const studentCount = studentCountMap[cls.id] || 0
          const score = studentCount > 0 ? returnedCount / studentCount : 0

          return {
            ...cls,
            count: returnedCount,
            studentCount,
            score,
          }
        })
        .sort((a, b) => b.score - a.score || b.count - a.count || a.name.localeCompare(b.name))

      setClassData(rankedClasses)

      const { data: pointsData } = await supabase
        .from('points_log')
        .select('student_id, points, students(name, nis, classes(name))')
        .gte('created_at', startOfMonth)

      const studentMap = {}
      pointsData?.forEach(p => {
        const key = p.student_id
        if (!studentMap[key]) {
          studentMap[key] = {
            id: key,
            ...p.students,
            total: 0,
          }
        }
        studentMap[key].total += p.points
      })

      setTopStudents(
        Object.values(studentMap)
          .sort((a, b) => b.total - a.total)
          .slice(0, 10)
      )
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

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Leaderboard & Gamifikasi</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })} — Ranking berbasis skor kelas
        </p>
      </div>

      {/* Badge Legend */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {CLASS_BADGE_LEVELS.map((b, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 20px',
              background: `linear-gradient(115deg, transparent 70%, rgba(255, 255, 255, 0.28) 70%), ${b.border}`,
              border: `1.5px solid ${b.border}`,
              borderRadius: 'var(--radius-md)',
              flex: '1 1 160px',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center' }}>
              {cloneElement(b.emoji, { size: 25, color: '#fff' })}
            </span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{b.name}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.85)' }}>{b.label}</div>
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
              fontSize: '13px',
              fontWeight: 600,
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
              <h3>Belum ada data kelas</h3>
              <p>Data akan muncul setelah kelas dan transaksi tersedia</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {classData.map((cls, idx) => {
                const badge = getBadge(cls.score)
                const rank = idx + 1
                const score = formatScore(cls.score)
                const progress = Math.min((cls.score / 5) * 100, 100)

                return (
                  <div
                    key={cls.id}
                    className="card"
                    style={{
                      padding: '20px 24px',
                      border:
                        rank === 1
                          ? '2px solid #f59e0b'
                          : badge
                            ? `1.5px solid ${badge.border}`
                            : '1px solid var(--border-light)',
                      background:
                        rank === 1
                          ? 'linear-gradient(135deg, #fffbeb 0%, #fff 100%)'
                          : badge
                            ? badge.bg
                            : 'white',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {rank === 1 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          width: '80px',
                          height: '80px',
                          background: 'rgba(251, 191, 36, 0.08)',
                          borderRadius: '0 0 0 80px',
                        }}
                      />
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      {/* Rank */}
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: rank <= 3 ? 'rgba(255,255,255,0.8)' : 'var(--bg-light)',
                          borderRadius: '50%',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <RankIcon rank={rank} />
                      </div>

                      {/* Class Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span style={{ fontSize: '16px', fontWeight: 700 }}>{cls.name}</span>
                          {badge && (
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '4px 10px',
                                borderRadius: '20px',
                                background: `linear-gradient(115deg, transparent 70%, rgba(255, 255, 255, 0.28) 70%), ${badge.border}`,
                                color: '#fff',
                                border: `1px solid ${badge.border}`,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              {cloneElement(badge.emoji, { size: 14, color: '#fff' })}
                              <span>{badge.name}</span>
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              flex: 1,
                              height: '8px',
                              background: 'rgba(0,0,0,0.06)',
                              borderRadius: '4px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                width: `${progress}%`,
                                background: badge ? badge.color : 'var(--primary)',
                                borderRadius: '4px',
                                transition: 'width 0.8s ease',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>
                            Skor {score}
                          </span>
                        </div>

                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Skor kelas bulan ini: {score}
                        </p>

                        {cls.teacher && (
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Wali Kelas: {cls.teacher}
                          </p>
                        )}
                      </div>

                      {/* Count Display */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div
                          style={{
                            fontSize: '28px',
                            fontWeight: 800,
                            color: badge ? badge.color : 'var(--text-primary)',
                            lineHeight: 1,
                          }}
                        >
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
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background:
                                i === 0
                                  ? '#fef3c7'
                                  : i === 1
                                    ? '#f3f4f6'
                                    : i === 2
                                      ? '#fef3c7'
                                      : 'var(--primary-pale)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '13px',
                              fontWeight: 700,
                              color:
                                i === 0
                                  ? '#f59e0b'
                                  : i === 1
                                    ? '#6b7280'
                                    : i === 2
                                      ? '#d97706'
                                      : 'var(--primary-dark)',
                            }}
                          >
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
                          <span
                            style={{
                              background: '#fffbeb',
                              color: '#d97706',
                              padding: '4px 10px',
                              borderRadius: '20px',
                              fontSize: '11px',
                              fontWeight: 700,
                            }}
                          >
                            ⭐ Elite Reader
                          </span>
                        ) : s.total >= 20 ? (
                          <span
                            style={{
                              background: '#eff6ff',
                              color: '#3b82f6',
                              padding: '4px 10px',
                              borderRadius: '20px',
                              fontSize: '11px',
                              fontWeight: 700,
                            }}
                          >
                            📚 Active Reader
                          </span>
                        ) : (
                          <span
                            style={{
                              background: 'var(--primary-pale)',
                              color: 'var(--primary-dark)',
                              padding: '4px 10px',
                              borderRadius: '20px',
                              fontSize: '11px',
                              fontWeight: 700,
                            }}
                          >
                            🌱 Beginner
                          </span>
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