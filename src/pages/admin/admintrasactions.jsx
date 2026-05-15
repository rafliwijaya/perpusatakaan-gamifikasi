import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Search, CheckCircle, RotateCcw, AlertTriangle, Clock, Filter } from 'lucide-react'
import toast from 'react-hot-toast'
import { differenceInDays } from 'date-fns'

const FINE_PER_DAY = 1000 // Rp 1.000/hari

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all | pending | borrowed | late | returned
  const [search, setSearch] = useState('')
  const [processingId, setProcessingId] = useState(null)

  useEffect(() => {
    fetchTransactions()
    // Auto-expire pending orders > 2 hours
    expirePendingOrders()
    // Auto-flag late returns
    flagLateReturns()
  }, [filter, search])

  const expirePendingOrders = async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const { data: expiredOrders } = await supabase
      .from('transactions')
      .select('id, book_id')
      .eq('status', 'pending')
      .lt('created_at', twoHoursAgo)

    if (expiredOrders?.length > 0) {
      for (const order of expiredOrders) {
        await supabase.from('transactions').update({ status: 'cancelled' }).eq('id', order.id)
        await supabase.from('books').update({ status: 'available' }).eq('id', order.book_id)
      }
    }
  }

  const flagLateReturns = async () => {
    const now = new Date().toISOString()
    const { data: lateOnes } = await supabase
      .from('transactions')
      .select('id, due_date')
      .eq('status', 'borrowed')
      .lt('due_date', now)

    if (lateOnes?.length > 0) {
      for (const t of lateOnes) {
        const daysLate = differenceInDays(new Date(), new Date(t.due_date))
        const fine = daysLate * FINE_PER_DAY
        await supabase.from('transactions')
          .update({ status: 'late', fine_amount: fine })
          .eq('id', t.id)
      }
    }
  }

  const fetchTransactions = async () => {
    setLoading(true)
    let query = supabase
      .from('transactions')
      .select('*, books(id, title, author, cover_url), students(id, name, nis), classes(name)')
      .order('created_at', { ascending: false })
      .limit(50)

    if (filter !== 'all') query = query.eq('status', filter)
    if (search) {
    }

    const { data, error } = await query
    if (!error) {
      let result = data || []
      if (search) {
        const s = search.toLowerCase()
        result = result.filter(t =>
          t.students?.name?.toLowerCase().includes(s) ||
          t.students?.nis?.toLowerCase().includes(s) ||
          t.books?.title?.toLowerCase().includes(s)
        )
      }
      setTransactions(result)
    }
    setLoading(false)
  }

  const handleApprove = async (t) => {
    setProcessingId(t.id)
    try {
      await supabase.from('transactions').update({ status: 'borrowed' }).eq('id', t.id)

      // cek apakah stok habis setelah approve
      const { data: bookData } = await supabase
        .from('books')
        .select('stock')
        .eq('id', t.book_id)
        .single()

      if (bookData?.stock > 0) {
        const { count: activeBorrows } = await supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('book_id', t.book_id)
          .in('status', ['borrowed', 'late'])

        if (activeBorrows >= bookData.stock) {
          await supabase.from('books').update({ status: 'borrowed' }).eq('id', t.book_id)
        }
      }

      toast.success(`Peminjaman disetujui: ${t.books?.title}`)
      fetchTransactions()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setProcessingId(null)
    }
  }

  const handleReturn = async (t) => {
    setProcessingId(t.id)
    try {
      const now = new Date()
      const dueDate = new Date(t.due_date)
      const daysLate = differenceInDays(now, dueDate)
      const fine = daysLate > 0 ? daysLate * FINE_PER_DAY : 0

      if (fine > 0) {
        const confirmed = confirm(
          `Buku ini terlambat ${daysLate} hari.\nDenda: Rp ${fine.toLocaleString('id-ID')}\n\nPastikan denda sudah dibayar sebelum menerima pengembalian.`
        )
        if (!confirmed) {
          setProcessingId(null)
          return
        }
      }

      await supabase.from('transactions').update({
        status: 'returned',
        return_date: now.toISOString(),
        fine_amount: fine,
      }).eq('id', t.id)

      await supabase.from('books').update({ status: 'available' }).eq('id', t.book_id)

      // poin award (5 pts ontime, 2 pts trlmabat)
      const points = fine === 0 ? 5 : 2
      await supabase.from('points_log').insert({
        student_id: t.student_id,
        transaction_id: t.id,
        points,
        description: fine === 0 ? 'Pengembalian tepat waktu' : 'Pengembalian terlambat',
      })

      await checkClassBadge(t.class_id)

      toast.success(`Buku berhasil dikembalikan${fine > 0 ? ` (denda Rp ${fine.toLocaleString('id-ID')})` : ''}`)
      fetchTransactions()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setProcessingId(null)
    }
  }

  const checkClassBadge = async (classId) => {
    if (!classId) return

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const { count } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', classId)
      .eq('status', 'returned')
      .gte('return_date', startOfMonth)

    const thresholds = [
      { count: 100, badge: 'Gold Reader 🥇', level: 3 },
      { count: 70, badge: 'Silver Reader 🥈', level: 2 },
      { count: 40, badge: 'Bronze Reader 🥉', level: 1 },
    ]

    for (const threshold of thresholds) {
      if (count >= threshold.count) {
        const { data: existing } = await supabase
          .from('class_badges')
          .select('id')
          .eq('class_id', classId)
          .eq('badge_name', threshold.badge)
          .gte('awarded_at', startOfMonth)
          .single()

        if (!existing) {
          await supabase.from('class_badges').insert({
            class_id: classId,
            badge_name: threshold.badge,
            badge_meta: { level: threshold.level, reads: count },
          })
          toast.success(`🏆 Kelas berhasil meraih badge: ${threshold.badge}!`, { duration: 5000 })
        }
        break
      }
    }
  }

  const statusTabs = [
    { id: 'all', label: 'Semua' },
    { id: 'pending', label: 'Menunggu ACC' },
    { id: 'borrowed', label: 'Dipinjam' },
    { id: 'late', label: 'Terlambat' },
    { id: 'returned', label: 'Dikembalikan' },
  ]

  const counts = { pending: 0, borrowed: 0, late: 0 }
  transactions.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++ })

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Manajemen Peminjaman</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>ACC, pengembalian, dan denda buku</p>
      </div>

      {/* quick statisks */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { label: 'Menunggu ACC', val: counts.pending, color: '#f59e0b', bg: '#fffbeb', icon: Clock },
          { label: 'Sedang Dipinjam', val: counts.borrowed, color: '#3b82f6', bg: '#eff6ff', icon: CheckCircle },
          { label: 'Terlambat', val: counts.late, color: '#ef4444', bg: '#fef2f2', icon: AlertTriangle },
        ].map((s, i) => (
          <div key={i} className="card" style={{
            padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 160px',
          }}>
            <div style={{ width: '40px', height: '40px', background: s.bg, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <s.icon size={18} color={s.color} />
            </div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 800 }}>{s.val}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* filters */}
      <div className="card" style={{ padding: '0', marginBottom: '20px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border-light)', overflowX: 'auto' }}>
          {statusTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              style={{
                padding: '14px 20px', border: 'none', cursor: 'pointer',
                fontFamily: 'Poppins, sans-serif', fontSize: '13px',
                fontWeight: filter === tab.id ? 600 : 500,
                color: filter === tab.id ? 'var(--primary-dark)' : 'var(--text-muted)',
                background: 'transparent',
                borderBottom: filter === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
              {counts[tab.id] > 0 && (
                <span style={{
                  marginLeft: '6px', padding: '2px 7px',
                  background: filter === tab.id ? 'var(--primary-pale)' : 'var(--bg-light)',
                  borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                  color: filter === tab.id ? 'var(--primary-dark)' : 'var(--text-muted)',
                }}>
                  {counts[tab.id]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div style={{ padding: '12px 16px' }}>
          <div style={{ position: 'relative', maxWidth: '320px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: '38px' }}
              placeholder="Cari siswa atau buku..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div className="spinner" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">
            <RotateCcw size={36} />
            <h3>Tidak ada transaksi</h3>
            <p>Belum ada peminjaman dengan status ini</p>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Buku</th>
                  <th>Siswa</th>
                  <th>Kelas</th>
                  <th>Tgl Pinjam</th>
                  <th>Batas Kembali</th>
                  <th>Denda</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => {
                  const isLate = t.status === 'late' || (t.status === 'borrowed' && new Date(t.due_date) < new Date())
                  const daysLate = isLate ? Math.max(0, differenceInDays(new Date(), new Date(t.due_date))) : 0
                  const currentFine = daysLate * FINE_PER_DAY

                  return (
                    <tr key={t.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {t.books?.cover_url ? (
                            <img src={t.books.cover_url} style={{ width: '36px', height: '46px', objectFit: 'cover', borderRadius: '5px' }} />
                          ) : (
                            <div style={{ width: '36px', height: '46px', background: 'var(--primary-pale)', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: '18px' }}>📚</span>
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '13px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t.books?.title || '-'}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.books?.author}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{t.students?.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.students?.nis}</div>
                      </td>
                      <td style={{ fontSize: '13px' }}>{t.classes?.name || '-'}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {new Date(t.borrow_date || t.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', color: isLate ? 'var(--danger)' : 'var(--text-muted)', fontWeight: isLate ? 600 : 400 }}>
                          {new Date(t.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        {isLate && daysLate > 0 && (
                          <div style={{ fontSize: '10px', color: 'var(--danger)' }}>{daysLate} hari terlambat</div>
                        )}
                      </td>
                      <td>
                        {(currentFine > 0 || t.fine_amount > 0) ? (
                          <span style={{ color: 'var(--danger)', fontWeight: 600, fontSize: '12px' }}>
                            Rp {(currentFine || t.fine_amount).toLocaleString('id-ID')}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>-</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge-chip ${t.status === 'borrowed' && isLate ? 'late' : t.status}`}>
                          {{ borrowed: 'Dipinjam', returned: 'Dikembalikan', late: 'Terlambat', pending: 'Menunggu ACC', cancelled: 'Dibatalkan' }[t.status] || t.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {t.status === 'pending' && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleApprove(t)}
                              disabled={processingId === t.id}
                            >
                              <CheckCircle size={12} />
                              ACC
                            </button>
                          )}
                          {(t.status === 'borrowed' || t.status === 'late') && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleReturn(t)}
                              disabled={processingId === t.id}
                            >
                              <RotateCcw size={12} />
                              Kembalikan
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
