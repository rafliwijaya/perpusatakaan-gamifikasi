import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
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
  ArcElement,
  Filler
} from 'chart.js'
import { TrendingUp, BookOpen, AlertTriangle, HandCoins, Printer } from 'lucide-react'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
)

const CLASS_LEVELS = [
  {
    min: 5.0001,
    name: 'Bintang Perpustakaan',
    color: '#f59e0b',
    bg: '#fffbeb',
    border: '#fbbf24',
  },
  {
    min: 2,
    name: 'Sahabat Buku',
    color: '#6b7280',
    bg: '#f9fafb',
    border: '#9ca3af',
  },
  {
    min: 0,
    name: 'Pemula Membaca',
    color: '#b45309',
    bg: '#fef3c7',
    border: '#d97706',
  },
]

function getClassLevel(score) {
  return CLASS_LEVELS.find(l => score >= l.min) || CLASS_LEVELS[2]
}

function formatScore(score) {
  return Number(score || 0).toFixed(1)
}

export default function AdminReports() {
  const [monthlyBorrows, setMonthlyBorrows] = useState([])
  const [categoryData, setCategoryData] = useState([])
  const [classMonthly, setClassMonthly] = useState([])
  const [bookTypeData, setBookTypeData] = useState([])
  const [fineData, setFineData] = useState({ total: 0, count: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReportData()
  }, [])

  const fetchReportData = async () => {
    try {
      const monthly = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString()

        const [{ count: total }, { count: returned }, { count: late }] = await Promise.all([
          supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', start)
            .lte('created_at', end),
          supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'returned')
            .gte('created_at', start)
            .lte('created_at', end),
          supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'late')
            .gte('created_at', start)
            .lte('created_at', end),
        ])

        monthly.push({
          label: d.toLocaleString('id-ID', { month: 'short', year: '2-digit' }),
          total: total || 0,
          returned: returned || 0,
          late: late || 0,
        })
      }
      setMonthlyBorrows(monthly)

      const { data: books } = await supabase
        .from('books')
        .select('category, type')

      const catMap = {}
      books?.forEach(b => {
        const c = b.category || 'Lainnya'
        catMap[c] = (catMap[c] || 0) + 1
      })
      setCategoryData(Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 8))

      const typeMap = {
        teks: 0,
        bergambar: 0,
        campuran: 0,
      }

      const { data: typeTxns } = await supabase
        .from('transactions')
        .select('id, books(type)')
        .in('status', ['borrowed', 'returned', 'late'])

      typeTxns?.forEach(t => {
        const type = t.books?.type
        if (typeMap[type] !== undefined) {
          typeMap[type]++
        }
      })

      setBookTypeData([
        { type: 'teks', label: 'Teks', value: typeMap.teks },
        { type: 'bergambar', label: 'Bergambar', value: typeMap.bergambar },
        { type: 'campuran', label: 'Campuran', value: typeMap.campuran },
      ].sort((a, b) => b.value - a.value))

      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

      const [classesRes, studentsRes, classTxnsRes] = await Promise.all([
        supabase.from('classes').select('id, name'),
        supabase.from('students').select('id, class_id'),
        supabase
          .from('transactions')
          .select('class_id')
          .eq('status', 'returned')
          .gte('return_date', startOfMonth),
      ])

      const classesData = classesRes.data || []
      const studentsData = studentsRes.data || []
      const classTxns = classTxnsRes.data || []

      const studentCountMap = {}
      studentsData.forEach(s => {
        if (s.class_id != null) {
          studentCountMap[s.class_id] = (studentCountMap[s.class_id] || 0) + 1
        }
      })

      const returnedCountMap = {}
      classTxns.forEach(t => {
        if (t.class_id != null) {
          returnedCountMap[t.class_id] = (returnedCountMap[t.class_id] || 0) + 1
        }
      })

      const classStats = classesData
        .map(cls => {
          const returnedCount = returnedCountMap[cls.id] || 0
          const studentCount = studentCountMap[cls.id] || 0
          const score = studentCount > 0 ? returnedCount / studentCount : 0

          return {
            id: cls.id,
            name: cls.name,
            returnedCount,
            studentCount,
            score,
          }
        })
        .sort((a, b) => b.score - a.score || b.returnedCount - a.returnedCount || a.name.localeCompare(b.name))

      setClassMonthly(classStats)

      const { data: fines } = await supabase
        .from('transactions')
        .select('fine_amount')
        .gt('fine_amount', 0)

      const totalFine = fines?.reduce((s, t) => s + (t.fine_amount || 0), 0) || 0
      setFineData({ total: totalFine, count: fines?.length || 0 })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const chartFont = { family: 'Poppins', size: 11 }
  const chartTooltipFont = { family: 'Poppins' }

  const lineData = {
    labels: monthlyBorrows.map(m => m.label),
    datasets: [
      {
        label: 'Total Peminjaman',
        data: monthlyBorrows.map(m => m.total),
        borderColor: '#87DB20',
        backgroundColor: 'rgba(135,219,32,0.08)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: '#87DB20',
      },
      {
        label: 'Dikembalikan',
        data: monthlyBorrows.map(m => m.returned),
        borderColor: '#3b82f6',
        backgroundColor: 'transparent',
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#3b82f6',
      },
    ],
  }

  const classBarData = {
    labels: classMonthly.map(c => c.name),
    datasets: [{
      label: 'Buku Dibaca',
      data: classMonthly.map(c => c.returnedCount),
      backgroundColor: classMonthly.map(c => {
        const level = getClassLevel(c.score)
        return level.color
      }),
      borderRadius: 8,
    }],
  }

  const typeBarData = {
    labels: bookTypeData.map(t => t.label),
    datasets: [{
      label: 'Jumlah Peminjaman',
      data: bookTypeData.map(t => t.value),
      backgroundColor: ['#87DB20', '#3b82f6', '#f59e0b'],
      borderRadius: 8,
    }],
  }

  const donutData = {
    labels: categoryData.map(([c]) => c),
    datasets: [{
      data: categoryData.map(([, n]) => n),
      backgroundColor: ['#87DB20', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'],
      borderWidth: 0,
    }],
  }

  const baseOptions = {
    responsive: true,
    plugins: {
      legend: { labels: { font: chartFont } },
      tooltip: { titleFont: chartTooltipFont, bodyFont: chartTooltipFont },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: chartFont } },
      y: { grid: { color: '#f0f4f6' }, ticks: { font: chartFont } },
    },
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="fade-in report-printable">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Laporan & Statistik</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Analitik perpustakaan</p>
        </div>

        <button
          className="btn btn-secondary no-print"
          onClick={handlePrint}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <Printer size={16} />
          Cetak / Simpan PDF
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Peminjaman (12 bln)', val: monthlyBorrows.reduce((s, m) => s + m.total, 0), icon: BookOpen, color: '#87DB20', bg: '#f0fad9' },
          { label: 'Terlambat (12 bln)', val: monthlyBorrows.reduce((s, m) => s + m.late, 0), icon: AlertTriangle, color: '#ef4444', bg: '#fef2f2' },
          { label: 'Total Denda Terkumpul', val: `Rp ${fineData.total.toLocaleString('id-ID')}`, icon: HandCoins, color: '#f59e0b', bg: '#fffbeb' },
          { label: 'Kasus Keterlambatan', val: fineData.count, icon: TrendingUp, color: '#8b5cf6', bg: '#f5f3ff' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ padding: '20px' }}>
            <div style={{ width: '40px', height: '40px', background: s.bg, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
              <s.icon size={20} color={s.color} />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800 }}>{s.val}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Line Chart */}
      <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>Tren Peminjaman 12 Bulan</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>Total vs dikembalikan</p>
        <Line
          data={lineData}
          options={{
            ...baseOptions,
            plugins: {
              ...baseOptions.plugins,
              legend: { position: 'top', labels: { font: chartFont } },
            },
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '20px' }} className="charts-grid">
        {/* Class Progress */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>Progress Kelas Bulan Ini</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Level: Pemula Membaca, Sahabat Buku, Bintang Perpustakaan
          </p>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', background: '#d97706', borderRadius: '2px', display: 'inline-block' }} /> &lt; 2
            </span>
            <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', background: '#6b7280', borderRadius: '2px', display: 'inline-block' }} /> 2 - 5
            </span>
            <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', background: '#f59e0b', borderRadius: '2px', display: 'inline-block' }} /> &gt; 5
            </span>
          </div>

          {classMonthly.length > 0 ? (
            <Bar
              data={classBarData}
              options={{
                ...baseOptions,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: ctx => {
                        const idx = ctx.dataIndex
                        const row = classMonthly[idx]
                        return ` ${ctx.raw} buku • skor ${formatScore(row?.score)}`
                      },
                    },
                    titleFont: chartTooltipFont,
                    bodyFont: chartTooltipFont,
                  },
                },
              }}
            />
          ) : (
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <p>Belum ada data bulan ini</p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Category Donut */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>Distribusi Koleksi Buku</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>Berdasarkan kategori</p>
            {categoryData.length > 0 ? (
              <Doughnut
                data={donutData}
                options={{
                  responsive: true,
                  plugins: { legend: { position: 'bottom', labels: { font: chartFont, padding: 10 } } },
                  cutout: '60%',
                }}
              />
            ) : (
              <div className="empty-state">
                <p>Belum ada data</p>
              </div>
            )}
          </div>

          {/* Book Type Analysis */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>Analisis Jenis Buku Dipinjam</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Teks vs Bergambar vs Campuran
            </p>

            {bookTypeData.length > 0 ? (
              <>
                <Bar
                  data={typeBarData}
                  options={{
                    ...baseOptions,
                    indexAxis: 'y',
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: ctx => ` ${ctx.raw} peminjaman`,
                        },
                        titleFont: chartTooltipFont,
                        bodyFont: chartTooltipFont,
                      },
                    },
                    scales: {
                      x: { grid: { color: '#f0f4f6' }, ticks: { font: chartFont } },
                      y: { grid: { display: false }, ticks: { font: chartFont } },
                    },
                  }}
                />

                <div style={{ marginTop: '14px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Paling banyak dipinjam:
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>
                    {bookTypeData[0]?.label || '-'}
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p>Belum ada data</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .charts-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media print {
          body {
            background: white !important;
          }

          .no-print {
            display: none !important;
          }

          .report-printable {
            width: 100% !important;
          }

          .card {
            box-shadow: none !important;
            border: 1px solid #e5e7eb !important;
            break-inside: avoid;
          }

          .charts-grid {
            grid-template-columns: 1fr !important;
          }

          .fade-in {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
}