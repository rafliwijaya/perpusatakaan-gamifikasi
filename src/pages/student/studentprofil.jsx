import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/authcontext'
import { Star, Award, BookOpen, Trophy, TrendingUp, Target } from 'lucide-react'

const BADGE_LEVELS = [
  { min: 100, name: 'Gold Reader 🥇', color: '#f59e0b', bg: '#fffbeb' },
  { min: 70, name: 'Silver Reader 🥈', color: '#6b7280', bg: '#f9fafb' },
  { min: 40, name: 'Bronze Reader 🥉', color: '#d97706', bg: '#fef3c7' },
]

export default function StudentProfile() {
  const { profile } = useAuth()
  const [stats, setStats] = useState(null)
  const [classRank, setClassRank] = useState(null)
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
      ] = await Promise.all([
        supabase.from('transactions').select('id, status, fine_amount').eq('student_id', profile.id),
        supabase.from('points_log').select('points').eq('student_id', profile.id),
        supabase.from('badges').select('*').eq('student_id', profile.id).order('awarded_at', { ascending: false }),
        supabase.from('transactions').select('id').eq('student_id', profile.id).eq('status', 'returned').gte('return_date', startOfMonth),
      ])

      const totalPoints = points?.reduce((s, p) => s + p.points, 0) || 0
      const totalReturned = transactions?.filter(t => t.status === 'returned').length || 0
      const totalFine = transactions?.reduce((s, t) => s + (t.fine_amount || 0), 0) || 0
      const monthlyReads = monthlyTx?.length || 0

      // Class rank this month (by points)
      if (profile?.class_id) {
        const { data: classPoints } = await supabase
          .from('points_log')
          .select('student_id, points, students!inner(class_id)')
          .eq('students.class_id', profile.class_id)
          .gte('created_at', startOfMonth)

        const studentPointMap = {}
        classPoints?.forEach(p => {
          studentPointMap[p.student_id] = (studentPointMap[p.student_id] || 0) + p.points
        })
        const sorted = Object.entries(studentPointMap).sort((a, b) => b[1] - a[1])
        const rank = sorted.findIndex(([id]) => id === profile.id) + 1
        setClassRank(rank > 0 ? rank : sorted.length + 1)
      }

      setStats({ totalPoints, totalReturned, totalFine, badges: badges || [], monthlyReads })
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

  const getClassBadge = (reads) => BADGE_LEVELS.find(b => reads >= b.min) || null

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
      <div className="spinner" />
    </div>
  )

  if (!stats) return null

  const level = getStudentLevel(stats.totalPoints)
  const classBadge = profile?.classes?.name ? getClassBadge(stats.monthlyReads) : null

  return (
    <div className="fade-in">
      {/* Profile Card */}
      <div className="card" style={{ padding: '28px', marginBottom: '20px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '80px', background: 'linear-gradient(135deg, #1a1f0e 0%, #2d3a14 100%)' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Avatar */}
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

          {/* Level Badge */}
          <div style={{ marginTop: '14px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 20px', background: level.bg, borderRadius: '999px', border: `1.5px solid ${level.color}` }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: level.color }}>{level.label}</span>
          </div>

          {level.next && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
              {/* +{level.next.needed} poin lagi untuk {level.next.label} */} Lorem ipsum dolor sit amet consectetur.
            </p>
          )}
        </div>
      </div>

      {/* Stats Grid */}
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

      {/* Class Progress */}
      <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Target size={16} color="var(--primary-dark)" />
          <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Progress Kelas Bulan Ini</h3>
        </div>

        {classBadge ? (
          <div style={{ textAlign: 'center', padding: '16px', background: classBadge.bg, borderRadius: '12px' }}>
            <div style={{ fontSize: '36px', marginBottom: '6px' }}>
              {classBadge.name.split(' ').pop()}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: classBadge.color }}>
              Kelas kamu meraih {classBadge.name}!
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Progress kelas bulan ini</span>
              <span style={{ fontSize: '12px', fontWeight: 700 }}>{stats.monthlyReads}/40 buku</span>
            </div>
            <div style={{ height: '10px', background: 'var(--bg-light)', borderRadius: '5px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.min((stats.monthlyReads / 40) * 100, 100)}%`,
                background: 'linear-gradient(90deg, var(--primary), var(--primary-dark))',
                borderRadius: '5px',
                transition: 'width 0.8s ease',
              }} />
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
              {40 - stats.monthlyReads > 0
                ? `${40 - stats.monthlyReads} buku lagi untuk raih 🥉 Bronze Badge!`
                : 'Target tercapai! 🎉'
              }
            </p>
          </div>
        )}
      </div>

      {/* Personal Badges */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Award size={16} color="#8b5cf6" />
          <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Badge Saya</h3>
        </div>

        {stats.badges.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <Award size={32} style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: '13px' }}>Belum ada badge. Terus baca untuk raih badge!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {stats.badges.map((b, i) => (
              <div key={i} style={{
                padding: '10px 16px',
                background: 'var(--primary-pale)',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--primary)',
                fontSize: '13px', fontWeight: 700,
                color: 'var(--primary-dark)',
              }}>
                {b.badge_name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
