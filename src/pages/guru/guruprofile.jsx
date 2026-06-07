import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/authcontext'
import { Users, Trophy, Crown, Medal, Star } from 'lucide-react'
import { Bar, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler)

const CLASS_BADGE_LEVELS = [
  {
    min: 5.0001,
    name: 'Bintang Perpustakaan',
    emoji: '⭐',
    color: '#f59e0b',
    bg: '#fffbeb',
    border: '#fbbf24',
    label: '> 5',
  },
  {
    min: 2,
    name: 'Sahabat Buku',
    emoji: '📚',
    color: '#6b7280',
    bg: '#f9fafb',
    border: '#9ca3af',
    label: '2 - 5',
  },
  {
    min: 0,
    name: 'Pemula Membaca',
    emoji: '🌱',
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

export default function GuruProfile() {
  const { profile } = useAuth()
  const [students, setStudents] = useState([])
  const [classRanking, setClassRanking] = useState([])
  const [topStudents, setTopStudents] = useState([])
  const [monthlyTrend, setMonthlyTrend] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('kelas')

  useEffect(() => {
    if (profile?.id) fetchData()
  }, [profile])

  const fetchData = async () => {
    try {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

      // Siswa di kelas guru — pakai class_id langsung dari profile
      const classId = profile?.class_id || profile?.classes?.id
      if (classId) {
        const { data: studentData } = await supabase
          .from('students')
          .select('id, name, nis')
          .eq('class_id', classId)
          .order('name')
        setStudents(studentData || [])
      }

      // Ranking kelas bulan ini: returned transaction / jumlah siswa
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

      setClassRanking(rankedClasses)

      // Top students bulan ini (semua kelas)
      const { data: pointsData } = await supabase
        .from('points_log')
        .select('student_id, points, students(name, nis, classes(name))')
        .gte('created_at', startOfMonth)

      const studentMap = {}
      pointsData?.forEach(p => {
        if (!studentMap[p.student_id]) studentMap[p.student_id] = { ...p.students, total: 0 }
        studentMap[p.student_id].total += p.points
      })
      setTopStudents(Object.values(studentMap).sort((a, b) => b.total - a.total).slice(0, 10))

      // Tren peminjaman 6 bulan
      const trend = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString()
        const { count } = await supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', start)
          .lte('created_at', end)
        trend.push({ label: d.toLocaleString('id-ID', { month: 'short' }), value: count || 0 })
      }
      setMonthlyTrend(trend)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const RankIcon = ({ rank }) => {
    if (rank === 1) return <Crown size={16} color="#f59e0b" />
    if (rank === 2) return <Medal size={14} color="#9ca3af" />
    if (rank === 3) return <Medal size={14} color="#d97706" />
    return <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', minWidth: '16px', textAlign: 'center' }}>{rank}</span>
  }

  const chartFont = { family: 'Poppins', size: 11 }

  const lineData = {
    labels: monthlyTrend.map(m => m.label),
    datasets: [
      {
        label: 'Peminjaman',
        data: monthlyTrend.map(m => m.value),
        borderColor: '#87DB20',
        backgroundColor: 'rgba(135,219,32,0.08)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: '#87DB20',
      },
    ],
  }

  const classBarData = {
    labels: classRanking.map(c => c.name),
    datasets: [
      {
        label: 'Skor Kelas',
        data: classRanking.map(c => c.score),
        backgroundColor: classRanking.map(c => (c.score > 5 ? '#f59e0b' : c.score >= 2 ? '#6b7280' : '#d97706')),
        borderRadius: 8,
      },
    ],
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
        <div className="spinner" />
      </div>
    )
  }

  const myClassId = profile?.class_id || profile?.classes?.id
  const myClass = classRanking.find(c => c.id === myClassId)
  const myClassRank = myClass ? classRanking.indexOf(myClass) + 1 : '-'
  const myClassBadge = myClass ? getBadge(myClass.score) : null

  return (
    <div className="fade-in">
      {/* Profile Card */}
      <div className="card" style={{ padding: '28px', marginBottom: '20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '80px', background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)' }} />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: '#3b82f6',
              margin: '20px auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 800,
              color: 'white',
              border: '4px solid white',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            {profile?.name?.charAt(0) || 'G'}
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '4px' }}>{profile?.name}</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>NIP: {profile?.nip}</p>

          <div
            style={{
              marginTop: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 16px',
              background: '#eff6ff',
              borderRadius: '999px',
              border: '1.5px solid #bfdbfe',
            }}
          >
            <Users size={14} color="#3b82f6" />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#3b82f6' }}>
              Wali Kelas {profile?.classes?.name || myClass?.name || '-'}
            </span>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '20px' }}>
          {[
            { label: 'Jumlah Murid', val: students.length, color: '#3b82f6' },
            { label: 'Rank Kelas', val: myClassRank !== '-' ? `#${myClassRank}` : '-', color: '#3b82f6' },
            { label: 'Skor Kelas', val: myClass ? formatScore(myClass.score) : '0.0', color: '#3b82f6' },
          ].map((s, i) => (
            <div key={i} className="card" style={{ padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: 800, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Badge kelas */}
        {myClassBadge && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px 16px',
              background: myClassBadge.bg,
              borderRadius: '12px',
              border: `1.5px solid ${myClassBadge.border}`,
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 700, color: myClassBadge.color }}>
              🏆 Kelas {profile?.classes?.name || myClass?.name} meraih {myClassBadge.name} bulan ini!
            </span>
          </div>
        )}
      </div>

      {/* Daftar Murid */}
      <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Users size={16} color="#3b82f6" />
          <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Murid Kelas {profile?.classes?.name || myClass?.name || '-'}</h3>
        </div>
        {students.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Belum ada murid di kelas ini</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
            {students.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  background: 'var(--bg-light)',
                  borderRadius: '10px',
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'var(--primary-pale)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--primary-dark)',
                    flexShrink: 0,
                  }}
                >
                  {s.name.charAt(0)}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.nis}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs: Leaderboard, Top Siswa, Tren */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', overflowX: 'auto' }}>
          {[
            { id: 'kelas', label: '🏫 Ranking Kelas' },
            { id: 'siswa', label: '⭐ Top Siswa' },
            { id: 'tren', label: '📈 Tren Peminjaman' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '14px 20px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Poppins, sans-serif',
                fontSize: '13px',
                fontWeight: activeTab === tab.id ? 600 : 500,
                color: activeTab === tab.id ? 'var(--primary-dark)' : 'var(--text-muted)',
                background: 'transparent',
                whiteSpace: 'nowrap',
                borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '20px' }}>
          {/* Ranking Kelas */}
          {activeTab === 'kelas' && (
            <div>
              {classRanking.length === 0 ? (
                <div className="empty-state">
                  <Trophy size={32} />
                  <p>Belum ada data bulan ini</p>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <Bar
                      data={classBarData}
                      options={{
                        responsive: true,
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            callbacks: {
                              label: ctx => ` ${Number(ctx.raw).toFixed(1)} skor`,
                            },
                            titleFont: { family: 'Poppins' },
                            bodyFont: { family: 'Poppins' },
                          },
                        },
                        scales: {
                          x: { grid: { display: false }, ticks: { font: chartFont } },
                          y: { grid: { color: '#f0f4f6' }, ticks: { font: chartFont } },
                        },
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {classRanking.map((cls, idx) => {
                      const badge = getBadge(cls.score)
                      const isMyClass = cls.id === myClassId
                      const score = formatScore(cls.score)

                      return (
                        <div
                          key={cls.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 16px',
                            borderRadius: '10px',
                            background: isMyClass ? 'var(--primary-pale)' : 'var(--bg-light)',
                            border: isMyClass ? '1.5px solid var(--primary)' : '1px solid transparent',
                          }}
                        >
                          <div style={{ width: '28px', display: 'flex', justifyContent: 'center' }}>
                            <RankIcon rank={idx + 1} />
                          </div>

                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700 }}>{cls.name}</span>
                              {isMyClass && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    background: 'var(--primary)',
                                    color: '#1a1f0e',
                                    padding: '2px 6px',
                                    borderRadius: '20px',
                                    fontWeight: 700,
                                  }}
                                >
                                  Kelas Saya
                                </span>
                              )}
                              {badge && (
                                <span style={{ fontSize: '10px', fontWeight: 700, color: badge.color }}>
                                  {badge.name}
                                </span>
                              )}
                            </div>

                            <div
                              style={{
                                height: '6px',
                                background: 'rgba(0,0,0,0.06)',
                                borderRadius: '3px',
                                overflow: 'hidden',
                                marginTop: '6px',
                              }}
                            >
                              <div
                                style={{
                                  height: '100%',
                                  width: `${Math.min((cls.score / 5) * 100, 100)}%`,
                                  background: badge ? badge.color : 'var(--primary)',
                                  borderRadius: '3px',
                                }}
                              />
                            </div>

                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                              Skor {score}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', minWidth: '70px', flexShrink: 0 }}>
                            <div
                              style={{
                                fontSize: '18px',
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
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Top Siswa */}
          {activeTab === 'siswa' && (
            <div>
              {topStudents.length === 0 ? (
                <div className="empty-state">
                  <Star size={32} />
                  <p>Belum ada data</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {topStudents.map((s, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 14px',
                        background: 'var(--bg-light)',
                        borderRadius: '10px',
                      }}
                    >
                      <div style={{ width: '28px', display: 'flex', justifyContent: 'center' }}>
                        <RankIcon rank={i + 1} />
                      </div>
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
                          flexShrink: 0,
                        }}
                      >
                        {s.name?.charAt(0)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{s.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.classes?.name}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Star size={13} color="#f59e0b" fill="#f59e0b" />
                        <span style={{ fontWeight: 700, fontSize: '14px' }}>{s.total}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tren Peminjaman */}
          {activeTab === 'tren' && (
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-secondary)' }}>
                Tren peminjaman 6 bulan terakhir (semua kelas)
              </h4>
              <Line
                data={lineData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: { label: ctx => ` ${ctx.raw} peminjaman` },
                      titleFont: { family: 'Poppins' },
                      bodyFont: { family: 'Poppins' },
                    },
                  },
                  scales: {
                    x: { grid: { display: false }, ticks: { font: chartFont } },
                    y: { grid: { color: '#f0f4f6' }, ticks: { font: chartFont } },
                  },
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}