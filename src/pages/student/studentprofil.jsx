import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/authcontext'
import { Star, Award, BookOpen, Trophy, TrendingUp, Target, Crown, Medal } from 'lucide-react'

const STUDENT_LEVELS = [
  { min: 50, label: '⭐ Elite Reader', color: '#f59e0b', bg: '#fffbeb', next: null },
  { min: 20, label: '📚 Active Reader', color: '#3b82f6', bg: '#eff6ff', next: { label: 'Elite Reader', needed: 30 } },
  { min: 0, label: '🌱 Beginner', color: '#87DB20', bg: '#f0fad9', next: { label: 'Active Reader', needed: 20 } },
]

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

function getStudentLevel(pts) {
  return STUDENT_LEVELS.find(level => pts >= level.min) || STUDENT_LEVELS[2]
}

function getClassBadge(score) {
  return CLASS_BADGE_LEVELS.find(b => score >= b.min) || CLASS_BADGE_LEVELS[2]
}

function getNextClassBadge(score) {
  if (score < 2) return { label: 'Sahabat Buku', needed: 2 - score }
  if (score >= 2 && score < 5) return { label: 'Bintang Perpustakaan', needed: 5 - score }
  return null
}

function formatScore(score) {
  return Number(score || 0).toFixed(1)
}

export default function StudentProfile() {
  const { profile } = useAuth()
  const [stats, setStats] = useState(null)
  const [classRank, setClassRank] = useState(null)
  const [classRanking, setClassRanking] = useState([])
  const [classBadges, setClassBadges] = useState([])
  const [allClassAchievements, setAllClassAchievements] = useState({}) // classId -> badges[]
  const [classNamesMap, setClassNamesMap] = useState({}) // classId -> name
  const [hoveredBadge, setHoveredBadge] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile?.id) fetchStats()
  }, [profile])

  const fetchStats = async () => {
    try {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

      const [
        { data: transactions },
        { data: points },
        { data: badges },
        { data: monthlyTx },
        { data: rankings },
      ] = await Promise.all([
        supabase.from('transactions').select('id, status, fine_amount').eq('student_id', profile.id),
        supabase.from('points_log').select('points').eq('student_id', profile.id),
        supabase.from('badges').select('*').eq('student_id', profile.id).order('awarded_at', { ascending: false }), // tetap fetch (kosong tapi tidak error)
        supabase
          .from('transactions')
          .select('id')
          .eq('student_id', profile.id)
          .eq('status', 'returned')
          .gte('return_date', startOfMonth),
        supabase.rpc('get_class_rankings'),
      ])

      // Fetch achievement badges kelas sendiri
      if (profile?.class_id) {
        const { data: achBadges } = await supabase
          .from('class_badges')
          .select('badge_name, badge_meta, awarded_at')
          .eq('class_id', profile.class_id)
          .eq('badge_meta->>type', 'achievement')
          .order('awarded_at', { ascending: true })
        setClassBadges(achBadges || [])
      }

      // Fetch semua achievement badges semua kelas + nama kelas
      const [{ data: allAch }, { data: allClasses }] = await Promise.all([
        supabase
          .from('class_badges')
          .select('class_id, badge_name, badge_meta, awarded_at')
          .eq('badge_meta->>type', 'achievement')
          .order('awarded_at', { ascending: true }),
        supabase.from('classes').select('id, name, teacher'),
      ])

      const achMap = {}
      ;(allAch || []).forEach(b => {
        if (!achMap[b.class_id]) achMap[b.class_id] = []
        achMap[b.class_id].push(b)
      })
      setAllClassAchievements(achMap)

      const namesMap = {}
      ;(allClasses || []).forEach(c => { namesMap[c.id] = c })
      setClassNamesMap(namesMap)

      const totalPoints = points?.reduce((s, p) => s + p.points, 0) || 0
      const totalReturned = transactions?.filter(t => t.status === 'returned').length || 0
      const totalFine = transactions?.reduce((s, t) => s + (t.fine_amount || 0), 0) || 0
      const monthlyReads = monthlyTx?.length || 0

      const sortedRankings = Array.isArray(rankings)
        ? [...rankings].sort((a, b) => (a.rank || 0) - (b.rank || 0))
        : []

      setClassRanking(sortedRankings)

      if (profile?.class_id) {
        const myClass = sortedRankings.find(c => Number(c.class_id) === Number(profile.class_id))
        setClassRank(myClass?.rank || null)
      } else {
        setClassRank(null)
      }

      setStats({
        totalPoints,
        totalReturned,
        totalFine,
        badges: badges || [],
        monthlyReads,
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const getStudentLevel = (pts) => {
    if (pts >= 50) return { label: '⭐ Elite Reader', color: '#f59e0b', bg: '#fffbeb', next: null }
    if (pts >= 20) return { label: '📚 Active Reader', color: '#3b82f6', bg: '#eff6ff', next: { label: 'Elite Reader', needed: 50 - pts } }
    return { label: '🌱 Beginner', color: '#87DB20', bg: '#f0fad9', next: { label: 'Active Reader', needed: 20 - pts } }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
      <div className="spinner" />
    </div>
  )

  if (!stats) return null

  const level = getStudentLevel(stats.totalPoints)
  const myClassId = profile?.class_id || profile?.classes?.id
  const myClass = classRanking.find(c => Number(c.class_id) === Number(myClassId))
  const classBadge = myClass ? getClassBadge(myClass.score) : null
  const nextClassBadge = myClass ? getNextClassBadge(Number(myClass.score) || 0) : null
  const topClasses = classRanking.slice(0, 5)

  const RankIcon = ({ rank }) => {
    if (rank === 1) return <Crown size={16} color="#f59e0b" />
    if (rank === 2) return <Medal size={14} color="#9ca3af" />
    if (rank === 3) return <Medal size={14} color="#d97706" />
    return <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', minWidth: '16px', textAlign: 'center' }}>{rank}</span>
  }

  return (
    <div className="fade-in">
      {/* Profile Card */}
      <div className="card" style={{ padding: '28px', marginBottom: '20px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '80px', background: 'linear-gradient(135deg, #1a1f0e 0%, #2d3a14 100%)' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '20px auto 16px',
            fontSize: '28px', fontWeight: 800, color: '#1a1f0e',
            border: '4px solid white',
            boxShadow: 'var(--shadow-md)',
          }}>
            {profile?.name?.charAt(0) || 'S'}
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '4px' }}>{profile?.name}</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            NIS: {profile?.nis} • Kelas {profile?.classes?.name || '-'}
          </p>

          <div style={{ marginTop: '14px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 20px', background: level.bg, borderRadius: '999px', border: `1.5px solid ${level.color}` }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: level.color }}>{level.label}</span>
          </div>

          {level.next && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
              {level.next.needed > 0
                ? `${level.next.needed} poin lagi untuk ${level.next.label}`
                : `Sudah masuk level ${level.label}`}
            </p>
          )}
        </div>
      </div>

      {/* Statistik grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Total Poin', val: stats.totalPoints, icon: Star, color: '#f59e0b', bg: '#fffbeb' },
          { label: 'Buku Dibaca', val: stats.totalReturned, icon: BookOpen, color: 'var(--primary)', bg: 'var(--primary-pale)' },
          { label: 'Bulan Ini', val: stats.monthlyReads, icon: TrendingUp, color: '#3b82f6', bg: '#eff6ff' },
          { label: 'Rank Kelas', val: classRank ? `#${classRank}` : '-', icon: Trophy, color: '#8b5cf6', bg: '#f5f3ff' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', background: s.bg, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.icon size={20} color={s.color} />
            </div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Leaderboard Kelas */}
      <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Trophy size={16} color="var(--primary-dark)" />
          <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Leaderboard Kelas Bulan Ini</h3>
        </div>

        {topClasses.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <Trophy size={32} />
            <p>Belum ada data kelas bulan ini</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {topClasses.map((cls) => {
              const badge = getClassBadge(cls.score)
              const isMyClass = Number(cls.class_id) === Number(myClassId)
              const score = formatScore(cls.score)

              return (
                <div
                  key={cls.class_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    background: isMyClass ? 'var(--primary-pale)' : 'var(--bg-light)',
                    borderRadius: '10px',
                    border: isMyClass ? '1.5px solid var(--primary)' : '1px solid transparent',
                  }}
                >
                  <div style={{ width: '28px', display: 'flex', justifyContent: 'center' }}>
                    <RankIcon rank={cls.rank} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>{cls.class_name}</span>
                      {isMyClass && (
                        <span style={{
                          fontSize: '10px',
                          background: 'var(--primary)',
                          color: '#1a1f0e',
                          padding: '2px 6px',
                          borderRadius: '20px',
                          fontWeight: 700,
                        }}>
                          Kelas Saya
                        </span>
                      )}
                      <span style={{ fontSize: '10px', fontWeight: 700, color: badge.color }}>
                        {badge.name}
                      </span>
                    </div>

                    <div style={{
                      height: '6px',
                      background: 'rgba(0,0,0,0.06)',
                      borderRadius: '3px',
                      overflow: 'hidden',
                      marginTop: '6px',
                    }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min((Number(cls.score) / 5) * 100, 100)}%`,
                          background: badge.color,
                          borderRadius: '3px',
                          transition: 'width 0.8s ease',
                        }}
                      />
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Skor {score} • {cls.returned_count} buku
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', minWidth: '70px', flexShrink: 0 }}>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: badge.color, lineHeight: 1 }}>
                      {score}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>skor</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Progress Kelas */}
      <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Target size={16} color="var(--primary-dark)" />
          <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Progress Kelas Bulan Ini</h3>
        </div>

        {myClass ? (
          classBadge ? (
            <div style={{ textAlign: 'center', padding: '16px', background: classBadge.bg, borderRadius: '12px' }}>
              <div style={{ fontSize: '36px', marginBottom: '6px' }}>
                {classBadge.emoji}
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: classBadge.color }}>
                Kelas kamu meraih {classBadge.name}!
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Skor kelas: {formatScore(myClass.score)} • {myClass.returned_count} buku returned
              </p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Progress kelas bulan ini</span>
                <span style={{ fontSize: '12px', fontWeight: 700 }}>
                  Skor {formatScore(myClass.score)} • {myClass.returned_count} buku
                </span>
              </div>
              <div style={{ height: '10px', background: 'var(--bg-light)', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min((Number(myClass.score) / 5) * 100, 100)}%`,
                  background: 'linear-gradient(90deg, var(--primary), var(--primary-dark))',
                  borderRadius: '5px',
                  transition: 'width 0.8s ease',
                }} />
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                {nextClassBadge
                  ? `${formatScore(nextClassBadge.needed)} skor lagi untuk raih ${nextClassBadge.label}`
                  : 'Target tertinggi tercapai! 🎉'
                }
              </p>
            </div>
          )
        ) : (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <Target size={32} />
            <p>Kelas belum terhubung</p>
          </div>
        )}
      </div>

      {/* Achievement Badge — semua kelas */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Award size={16} color="#d97706" />
          <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Achievement Kelas</h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>— badge permanen per kelas</span>
        </div>

        {Object.keys(allClassAchievements).length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <Award size={32} style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Belum ada kelas yang meraih achievement.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Object.entries(allClassAchievements)
              .sort(([a], [b]) => {
                // Kelas sendiri di atas
                if (Number(a) === Number(profile?.class_id)) return -1
                if (Number(b) === Number(profile?.class_id)) return 1
                return (classNamesMap[a]?.name || '').localeCompare(classNamesMap[b]?.name || '')
              })
              .map(([classId, badges]) => {
                const cls = classNamesMap[classId]
                const isMyClass = Number(classId) === Number(profile?.class_id)
                return (
                  <div key={classId} style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: isMyClass ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                    background: isMyClass ? 'var(--primary-pale)' : 'var(--bg-light)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>{cls?.name || `Kelas ${classId}`}</span>
                      {isMyClass && (
                        <span style={{ fontSize: '10px', background: 'var(--primary)', color: '#1a1f0e', padding: '2px 8px', borderRadius: '20px', fontWeight: 700 }}>
                          Kelas Saya
                        </span>
                      )}
                      {cls?.teacher && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>• {cls.teacher}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {badges.map((b, i) => {
                        const emoji = b.badge_meta?.emoji || '🏅'
                        const tooltipKey = `ach-${classId}-${i}`
                        const isHovered = hoveredBadge === tooltipKey
                        const awardedDate = new Date(b.awarded_at).toLocaleDateString('id-ID', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        })
                        return (
                          <div key={i} style={{ position: 'relative', display: 'inline-block' }}
                            onMouseEnter={() => setHoveredBadge(tooltipKey)}
                            onMouseLeave={() => setHoveredBadge(null)}
                          >
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              padding: '4px 10px',
                              background: 'white',
                              border: '1.5px solid #d97706',
                              borderRadius: '20px',
                              fontSize: '11px', fontWeight: 700,
                              color: '#92400e', cursor: 'default',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                            }}>
                              {emoji} {b.badge_name}
                            </span>
                            {isHovered && (
                              <div style={{
                                position: 'absolute',
                                bottom: 'calc(100% + 6px)',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                background: '#1a1f0e', color: 'white',
                                padding: '6px 12px', borderRadius: '8px',
                                fontSize: '11px', fontWeight: 500,
                                whiteSpace: 'nowrap', zIndex: 100,
                                pointerEvents: 'none',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                              }}>
                                Tercapai pada {awardedDate}
                                <div style={{
                                  position: 'absolute', top: '100%', left: '50%',
                                  transform: 'translateX(-50%)',
                                  width: 0, height: 0,
                                  borderLeft: '5px solid transparent',
                                  borderRight: '5px solid transparent',
                                  borderTop: '5px solid #1a1f0e',
                                }} />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}