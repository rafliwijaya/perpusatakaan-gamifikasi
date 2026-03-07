import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { BookOpen, Clock, CheckCircle, AlertTriangle, Calendar } from 'lucide-react'
import { differenceInDays } from 'date-fns'

const FINE_PER_DAY = 1000

export default function StudentHistory() {
  const { profile } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (profile?.id) fetchHistory()
  }, [profile, filter])

  const fetchHistory = async () => {
    setLoading(true)
    let query = supabase
      .from('transactions')
      .select('*, books(title, author, cover_url, category)')
      .eq('student_id', profile.id)
      .order('created_at', { ascending: false })

    if (filter !== 'all') query = query.eq('status', filter)

    const { data } = await query
    setTransactions(data || [])
    setLoading(false)
  }

  const tabs = [
    { id: 'all', label: 'Semua' },
    { id: 'pending', label: 'Menunggu' },
    { id: 'borrowed', label: 'Dipinjam' },
    { id: 'late', label: 'Terlambat' },
    { id: 'returned', label: 'Dikembalikan' },
  ]

  const now = new Date()
  const totalFine = transactions.reduce((s, t) => s + (t.fine_amount || 0), 0)
  const overdueCount = transactions.filter(t => t.status === 'late').length

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Riwayat Peminjaman</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Semua aktivitas peminjaman bukumu</p>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { label: 'Total Peminjaman', val: transactions.filter(t=>t.status!=='pending').length, color: 'var(--primary)', icon: BookOpen },
          { label: 'Terlambat', val: overdueCount, color: '#ef4444', icon: AlertTriangle },
          { label: 'Total Denda', val: `Rp ${totalFine.toLocaleString('id-ID')}`, color: '#f59e0b', icon: Clock },
        ].map((s, i) => (
          <div key={i} className="card" style={{ padding: '16px 20px', flex: '1 1 140px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <s.icon size={20} color={s.color} />
            <div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="card" style={{ padding: '0', marginBottom: '16px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--border-light)' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              style={{
                padding: '13px 18px', border: 'none', cursor: 'pointer',
                fontFamily: 'Poppins, sans-serif', fontSize: '13px',
                fontWeight: filter === tab.id ? 600 : 500,
                color: filter === tab.id ? 'var(--primary-dark)' : 'var(--text-muted)',
                background: 'transparent',
                borderBottom: filter === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="spinner" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="card empty-state">
          <BookOpen size={40} />
          <h3>Belum ada riwayat</h3>
          <p>Mulai pinjam buku dari beranda!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {transactions.map(t => {
            const dueDate = new Date(t.due_date)
            const isLate = (t.status === 'borrowed' || t.status === 'late') && dueDate < now
            const daysLate = isLate ? differenceInDays(now, dueDate) : 0
            const currentFine = daysLate > 0 ? daysLate * FINE_PER_DAY : t.fine_amount || 0

            return (
              <div key={t.id} className="card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  {/* Cover */}
                  <div style={{
                    width: '52px', height: '68px', flexShrink: 0,
                    background: 'var(--primary-pale)', borderRadius: '8px',
                    overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {t.books?.cover_url ? (
                      <img src={t.books.cover_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <BookOpen size={24} color="var(--primary)" strokeWidth={1.5} />
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.books?.title || '-'}
                      </h4>
                      <span className={`badge-chip ${isLate ? 'late' : t.status}`} style={{ flexShrink: 0, fontSize: '10px' }}>
                        {{ pending: '⏳ Menunggu', borrowed: '📖 Dipinjam', returned: '✓ Dikembalikan', late: '⚠️ Terlambat', cancelled: 'Dibatalkan' }[t.status] || t.status}
                      </span>
                    </div>

                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      {t.books?.author || 'Penulis tidak diketahui'}
                    </p>

                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={11} color="var(--text-muted)" />
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Pinjam: {new Date(t.borrow_date || t.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>

                      {t.status !== 'pending' && t.status !== 'cancelled' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={11} color={isLate ? 'var(--danger)' : 'var(--text-muted)'} />
                          <span style={{ fontSize: '11px', color: isLate ? 'var(--danger)' : 'var(--text-muted)', fontWeight: isLate ? 600 : 400 }}>
                            Batas: {dueDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {isLate && daysLate > 0 && ` (${daysLate} hari lewat)`}
                          </span>
                        </div>
                      )}

                      {t.return_date && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={11} color="var(--success)" />
                          <span style={{ fontSize: '11px', color: 'var(--success)' }}>
                            Kembali: {new Date(t.return_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      )}
                    </div>

                    {currentFine > 0 && (
                      <div style={{
                        marginTop: '8px', padding: '6px 12px',
                        background: '#fef2f2', borderRadius: '8px',
                        fontSize: '12px', color: 'var(--danger)', fontWeight: 600,
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                      }}>
                        ⚠️ Denda: Rp {currentFine.toLocaleString('id-ID')}
                        {t.status === 'late' && ' (belum dibayar)'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
