import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import {
  BookOpen, Users, ArrowLeftRight, AlertTriangle,
  TrendingUp, Trophy, Clock, CheckCircle, GraduationCap
} from 'lucide-react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Title, Tooltip, Legend, ArcElement
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, ArcElement)

export default function AdminDashboard() {
  const [stats, setStats] = useState({ books: 0, students: 0, teachers: 0, borrowed: 0, overdue: 0, returned_today: 0 })
  const [monthlyData, setMonthlyData] = useState([])
  const [classProgress, setClassProgress] = useState([])
  const [recentTransactions, setRecentTransactions] = useState([])
  const [allTransactions, setAllTransactions] = useState([])
  const [txPage, setTxPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const TX_PER_PAGE = 10

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const [
        { count: bookCount },
        { count: studentCount },
        { count: teachersCount },
        { count: borrowedCount },
        { count: overdueCount },
        { data: recent },
        { data: classData },
      ] = await Promise.all([
        supabase.from('books').select('*', { count: 'exact', head: true }),
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('teachers').select('*', { count: 'exact', head: true }),
        supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'borrowed'),
        supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'late'),
        supabase.from('transactions')
          .select('*, books(title, author), students(name, nis), classes(name)')
          .order('created_at', { ascending: false })
          .limit(150),
        supabase.from('transactions')
          .select('class_id, classes(name)')
          .eq('status', 'returned')
          .gte('return_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      ])

      setStats({
        books: bookCount || 0,
        students: studentCount || 0,
        teachers: teachersCount || 0,
        borrowed: borrowedCount || 0,
        overdue: overdueCount || 0,
      })

      setAllTransactions(recent || [])
      setRecentTransactions((recent || []).slice(0, 15))

      const classMap = {}
      ;(classData || []).forEach(t => {
        const key = t.class_id
        if (!classMap[key]) classMap[key] = { name: t.classes?.name || 'Kelas ?', count: 0 }
        classMap[key].count++
      })
      const sorted = Object.values(classMap).sort((a, b) => b.count - a.count)
      setClassProgress(sorted)

      // Monthly data 6 bln terkahir
      const monthly = []
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
        monthly.push({
          label: d.toLocaleString('id-ID', { month: 'short' }),
          value: count || 0,
        })
      }
      setMonthlyData(monthly)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    { label: 'Total Buku', value: stats.books, icon: BookOpen, color: '#87DB20', bg: '#f0fad9', change: 'Koleksi tersedia' },
    { label: 'Total Siswa', value: stats.students, icon: Users, color: '#3b82f6', bg: '#eff6ff', change: 'Terdaftar' },
    { label: 'Total Guru', value: stats.teachers, icon: GraduationCap, color: '#f0f63b', bg: '#eff6ff', change: 'Terdaftar' },
    { label: 'Sedang Dipinjam', value: stats.borrowed, icon: ArrowLeftRight, color: '#f59e0b', bg: '#fffbeb', change: 'Aktif' },
    { label: 'Terlambat', value: stats.overdue, icon: AlertTriangle, color: '#ef4444', bg: '#fef2f2', change: 'Perlu tindakan' },
  ]

  const barData = {
    labels: monthlyData.map(m => m.label),
    datasets: [{
      label: 'Peminjaman',
      data: monthlyData.map(m => m.value),
      backgroundColor: 'rgba(135,219,32,0.8)',
      borderRadius: 8,
      borderSkipped: false,
    }],
  }

  const barOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: ctx => ` ${ctx.raw} peminjaman` },
        titleFont: { family: 'Poppins' },
        bodyFont: { family: 'Poppins' },
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: 'Poppins', size: 11 } } },
      y: { grid: { color: '#f0f4f6' }, ticks: { font: { family: 'Poppins', size: 11 } } },
    }
  }

  const donutData = {
    labels: classProgress.slice(0, 5).map(c => c.name),
    datasets: [{
      data: classProgress.slice(0, 5).map(c => c.count),
      backgroundColor: ['#87DB20', '#6ab818', '#a8e84d', '#3b82f6', '#f59e0b'],
      borderWidth: 0,
    }]
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>Dashboard</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {statCards.map((s, i) => (
          <div key={i} className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{
                width: '44px', height: '44px',
                background: s.bg,
                borderRadius: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <s.icon size={21} color={s.color} />
              </div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
              {s.value.toLocaleString()}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '6px' }}>{s.label}</div>
            <div style={{ fontSize: '11px', color: s.color, marginTop: '4px', fontWeight: 500 }}>{s.change}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', marginBottom: '24px' }} className="charts-grid">
        {/* Bar Chart */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Tren Peminjaman</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>6 bulan terakhir</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--primary-pale)', padding: '6px 12px', borderRadius: '20px' }}>
              <TrendingUp size={13} color="var(--primary-dark)" />
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--primary-dark)' }}>
                {monthlyData[monthlyData.length - 1]?.value || 0} bulan ini
              </span>
            </div>
          </div>
          <Bar data={barData} options={barOptions} />
        </div>

        {/* Donut Chart */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>Peminjaman per Kelas</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>Bulan ini</p>
          {classProgress.length > 0 ? (
            <>
              <Doughnut data={donutData} options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: { font: { family: 'Poppins', size: 11 }, padding: 12 }
                  }
                },
                cutout: '65%',
              }} />
              {/* Progress bars */}
              <div style={{ marginTop: '16px' }}>
                {classProgress.slice(0, 4).map((c, i) => (
                  <div key={i} style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 500 }}>{c.name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {c.count}/40 buku
                      </span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--bg-light)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min((c.count / 40) * 100, 100)}%`,
                        background: c.count >= 40 ? '#87DB20' : c.count >= 25 ? '#f59e0b' : '#ef4444',
                        borderRadius: '3px',
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              <Trophy size={32} />
              <p>Belum ada data bulan ini</p>
            </div>
          )}
        </div>
      </div>

      {/* Transaksi Terbaru dengan Pagination */}
      <div className="card">
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Transaksi Terbaru</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {allTransactions.length > 0
                ? `${Math.min((txPage - 1) * TX_PER_PAGE + 1, allTransactions.length)}–${Math.min(txPage * TX_PER_PAGE, allTransactions.length)} dari ${allTransactions.length} transaksi`
                : 'Aktivitas peminjaman terkini'}
            </p>
          </div>
        </div>
        <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
          {allTransactions.length === 0 ? (
            <div className="empty-state">
              <ArrowLeftRight size={32} />
              <h3>Belum ada transaksi</h3>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Siswa</th>
                  <th>Buku</th>
                  <th>Kelas</th>
                  <th>Tanggal Pinjam</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {allTransactions.slice((txPage - 1) * TX_PER_PAGE, txPage * TX_PER_PAGE).map(t => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                        {t.students?.name || '-'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.students?.nis}</div>
                    </td>
                    <td style={{ fontSize: '13px', maxWidth: '180px' }}>
                      <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.books?.title || '-'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.books?.author}</div>
                    </td>
                    <td style={{ fontSize: '13px' }}>{t.classes?.name || '-'}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {new Date(t.borrow_date || t.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </td>
                    <td>
                      <span className={`badge-chip ${t.status}`}>{
                        { borrowed: 'Dipinjam', returned: 'Dikembalikan', late: 'Terlambat', pending: 'Menunggu ACC' }[t.status] || t.status
                      }</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination — hanya muncul jika lebih dari 15 transaksi */}
        {allTransactions.length > TX_PER_PAGE && (
          <div style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px',
          }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Halaman {txPage} dari {Math.ceil(allTransactions.length / TX_PER_PAGE)}
            </span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                onClick={() => setTxPage(p => Math.max(1, p - 1))}
                disabled={txPage === 1}
                style={{
                  padding: '7px 14px', borderRadius: '8px',
                  border: '1.5px solid var(--border)', background: 'white',
                  cursor: txPage === 1 ? 'not-allowed' : 'pointer',
                  fontFamily: 'Poppins, sans-serif', fontSize: '13px', fontWeight: 600,
                  color: txPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                  opacity: txPage === 1 ? 0.45 : 1, transition: 'opacity 0.15s',
                }}
              >← Prev</button>

              {Array.from({ length: Math.ceil(allTransactions.length / TX_PER_PAGE) }, (_, i) => (
                <button key={i} onClick={() => setTxPage(i + 1)} style={{
                  width: '34px', height: '34px', borderRadius: '8px', border: '1.5px solid',
                  borderColor: txPage === i + 1 ? 'var(--primary)' : 'var(--border)',
                  background: txPage === i + 1 ? 'var(--primary)' : 'white',
                  color: txPage === i + 1 ? '#1a1f0e' : 'var(--text-secondary)',
                  cursor: 'pointer', fontFamily: 'Poppins', fontWeight: 600, fontSize: '13px',
                }}>{i + 1}</button>
              ))}

              <button
                onClick={() => setTxPage(p => Math.min(Math.ceil(allTransactions.length / TX_PER_PAGE), p + 1))}
                disabled={txPage === Math.ceil(allTransactions.length / TX_PER_PAGE)}
                style={{
                  padding: '7px 14px', borderRadius: '8px',
                  border: '1.5px solid var(--border)', background: 'white',
                  cursor: txPage === Math.ceil(allTransactions.length / TX_PER_PAGE) ? 'not-allowed' : 'pointer',
                  fontFamily: 'Poppins, sans-serif', fontSize: '13px', fontWeight: 600,
                  color: txPage === Math.ceil(allTransactions.length / TX_PER_PAGE) ? 'var(--text-muted)' : 'var(--text-primary)',
                  opacity: txPage === Math.ceil(allTransactions.length / TX_PER_PAGE) ? 0.45 : 1, transition: 'opacity 0.15s',
                }}
              >Next →</button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 900px) {
          .charts-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
