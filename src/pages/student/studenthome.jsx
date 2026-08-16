import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/authcontext'
import { Search, MapPin, BookOpen, Tag, Filter, X, CheckCircle, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

export default function StudentHome() {
  const { profile } = useAuth()
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [categories, setCategories] = useState([])
  const [borrowing, setBorrowing] = useState(null)
  const [activeBorrows, setActiveBorrows] = useState([])
  const [hasFine, setHasFine] = useState(false)
  const [borrowCountPerBook, setBorrowCountPerBook] = useState({})
  const realtimeChannelRef = useRef(null)
  const booksRef = useRef([])

  useEffect(() => { booksRef.current = books }, [books])

  useEffect(() => {
    fetchBooks()
    fetchCategories()
    if (profile?.id) {
      checkStudentStatus()
    }
  }, [search, filterCategory, filterType, filterStatus, profile])

  useEffect(() => {
    const channel = supabase
      .channel(`transactions-stok-siswa-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        () => {
          if (booksRef.current.length > 0) {
            fetchBorrowCounts(booksRef.current)
          }
        }
      )
      .subscribe()

    realtimeChannelRef.current = channel

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current)
      }
    }
  }, [])

  const fetchCategories = async () => {
    const { data } = await supabase.from('books').select('category').not('category', 'is', null)
    const unique = [...new Set(data?.map(b => b.category).filter(Boolean))]
    setCategories(unique)
  }

  const checkStudentStatus = async () => {
    const { data: borrows } = await supabase
      .from('transactions')
      .select('*')
      .eq('student_id', profile.id)
      .in('status', ['borrowed', 'late', 'pending'])

    setActiveBorrows(borrows || [])

    const { data: fines } = await supabase
      .from('transactions')
      .select('fine_amount')
      .eq('student_id', profile.id)
      .eq('status', 'late')
      .gt('fine_amount', 0)

    setHasFine(fines && fines.length > 0)
  }

  const fetchBooks = async () => {
    setLoading(true)
    let query = supabase
      .from('books')
      .select('*, locations(aisle, rack)')
      .order('title')

    if (search) query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%,category.ilike.%${search}%`)
    if (filterCategory) query = query.eq('category', filterCategory)
    if (filterType) query = query.eq('type', filterType)
    if (filterStatus) query = query.eq('status', filterStatus)
    else query = query.in('status', ['available', 'borrowed'])

    const { data, error } = await query.limit(60)
    if (!error) {
      setBooks(data || [])
      await fetchBorrowCounts(data || [])
    }
    setLoading(false)
  }

  const fetchBorrowCounts = async (bookList) => {
    if (!bookList || !bookList.length) {
      setBorrowCountPerBook({})
      return
    }
    const bookIds = bookList.map(b => b.id)
    const { data, error } = await supabase
      .from('book_borrow_counts')
      .select('book_id')
      .in('book_id', bookIds)
    if (error) { console.error('fetchBorrowCounts error:', error); return }
    const counts = {}
    ;(data || []).forEach(t => {
      counts[t.book_id] = (counts[t.book_id] || 0) + 1
    })
    setBorrowCountPerBook({ ...counts })
  }

  const handleBorrow = async (book) => {
    if (hasFine) {
      toast.error('Kamu memiliki denda yang belum dibayar. Hubungi admin perpustakaan.')
      return
    }

    // Maks 3 buku aktif
    const activeBorrowCount = activeBorrows.filter(b => ['borrowed', 'pending', 'late'].includes(b.status)).length
    if (activeBorrowCount >= 3) {
      toast.error('Kamu sudah meminjam 3 buku. Kembalikan buku terlebih dahulu sebelum meminjam lagi.', { duration: 4000 })
      return
    }

    const alreadyBorrowing = activeBorrows.find(b => b.book_id === book.id)
    if (alreadyBorrowing) {
      toast.error('Kamu sudah meminjam atau mengajukan buku ini.')
      return
    }

    if (book.stock > 0) {
      const { data: activeTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('book_id', book.id)
        .in('status', ['borrowed', 'pending', 'late'])
      const activeCount = activeTx?.length || 0
      if (activeCount >= book.stock) {
        toast.error('Stok buku ini sudah habis.')
        fetchBooks() // refresh tampilan
        return
      }
    } else if (book.status !== 'available') {
      toast.error('Buku ini sedang dipinjam oleh siswa lain.')
      return
    }

    setBorrowing(book.id)
    try {
      const { error: txError } = await supabase.from('transactions').insert({
        book_id: book.id,
        student_id: profile.id,
        class_id: profile.class_id,
        status: 'pending',
        borrow_date: new Date().toISOString(),
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })

      if (txError) throw txError

      toast.success(
        `Permintaan pinjam "${book.title}" berhasil! Ambil buku di perpustakaan dan tunjukkan ke admin untuk konfirmasi.`,
        { duration: 3000 }
      )

      await checkStudentStatus()
      await fetchBooks()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBorrowing(null)
    }
  }

  const isBookPendingByMe = (book) => activeBorrows.some(b => b.book_id === book.id && b.status === 'pending')
  const isBookBorrowedByMe = (book) => activeBorrows.some(b => b.book_id === book.id && b.status === 'borrowed')

  const clearFilters = () => {
    setSearch(''); setFilterCategory(''); setFilterType(''); setFilterStatus('')
  }
  const hasFilters = search || filterCategory || filterType || filterStatus

  return (
    <div className="fade-in">
      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1f0e 0%, #2d3a14 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: '28px 32px',
        marginBottom: '24px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px', background: 'rgba(135,219,32,0.08)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '-60px', right: '80px', width: '140px', height: '140px', background: 'rgba(135,219,32,0.05)', borderRadius: '50%' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Selamat datang
          </p>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'white', marginBottom: '8px' }}>
            {profile?.name?.split(' ')[0] || 'Siswa'} 👋
          </h1>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginBottom: '16px' }}>
            Kelas {profile?.classes?.name || '-'} • NIS {profile?.nis}
          </p>

          {hasFine && (
            <div style={{
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '10px', padding: '10px 16px',
              display: 'flex', alignItems: 'center', gap: '8px',
              fontSize: '12px', color: '#fca5a5',
            }}>
              Kamu memiliki denda yang belum dibayar. Hubungi admin untuk melunasi denda sebelum bisa meminjam lagi.
            </div>
          )}

          {!hasFine && activeBorrows.filter(b => b.status === 'pending').length > 0 && (
            <div style={{
              background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: '10px', padding: '10px 16px',
              fontSize: '12px', color: '#fcd34d',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <Clock size={14} />
              {activeBorrows.filter(b => b.status === 'pending').length} permintaan pinjam menunggu konfirmasi admin.
            </div>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: '44px', fontSize: '14px' }}
            placeholder="Cari judul buku, penulis, atau kategori..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '12px' }}>
            <Filter size={13} /> Filter:
          </div>
          <select className="input" style={{ width: 'auto', fontSize: '12px', padding: '7px 12px' }}
            value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">Semua Kategori</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input" style={{ width: 'auto', fontSize: '12px', padding: '7px 12px' }}
            value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">Semua Tipe</option>
            <option value="teks">Teks</option>
            <option value="bergambar">Bergambar</option>
            <option value="campuran">Campuran</option>
          </select>
          <select className="input" style={{ width: 'auto', fontSize: '12px', padding: '7px 12px' }}
            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Semua Status</option>
            <option value="available">Tersedia</option>
            <option value="borrowed">Dipinjam</option>
          </select>
          {hasFilters && (
            <button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ fontSize: '12px' }}>
              <X size={13} /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {loading ? 'Memuat...' : `${books.length} buku ditemukan`}
        </p>
      </div>

      {/* Books Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div className="spinner" />
        </div>
      ) : books.length === 0 ? (
        <div className="card empty-state">
          <BookOpen size={48} />
          <h3>Tidak ada buku</h3>
          <p>Coba ubah kata kunci atau filter pencarian</p>
          {hasFilters && <button className="btn btn-primary btn-sm" style={{ marginTop: '12px' }} onClick={clearFilters}>Reset Filter</button>}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '16px',
        }}>
          {books.map(book => {
            const isPendingByMe = isBookPendingByMe(book)
            const isBorrowedByMe = isBookBorrowedByMe(book)
            const activeBorrowCount = borrowCountPerBook[book.id] || 0
            const stockAvailable = book.stock > 0 ? Math.max(0, book.stock - activeBorrowCount) : null
            const available = book.status === 'available' && (book.stock === 0 || stockAvailable > 0)

            return (
              <div
                key={book.id}
                className="card"
                style={{
                  overflow: 'hidden',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  opacity: (!available && !isPendingByMe && !isBorrowedByMe) ? 0.72 : 1,
                }}
                onMouseEnter={e => {
                  if (available) {
                    e.currentTarget.style.transform = 'translateY(-3px)'
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                  }
                }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
              >
                {/* Cover */}
                <div style={{
                  height: '180px',
                  background: 'var(--primary-pale)',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {book.cover_url ? (
                    <img src={book.cover_url} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <BookOpen size={48} color="var(--primary)" strokeWidth={1.5} />
                    </div>
                  )}

                  {/* Status overlay */}
                  <div style={{ position: 'absolute', top: '8px', left: '8px' }}>
                    {isPendingByMe ? (
                      <span style={{ background: '#fef3c7', color: '#d97706', padding: '3px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={9} /> Pending
                      </span>
                    ) : isBorrowedByMe ? (
                      <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle size={9} /> Dipinjam
                      </span>
                    ) : !available ? (
                      <span style={{ background: 'rgba(0,0,0,0.6)', color: 'white', padding: '3px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 600 }}>
                        Tidak Tersedia
                      </span>
                    ) : (
                      <span style={{ background: 'var(--primary)', color: '#1a1f0e', padding: '3px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700 }}>
                        Tersedia
                      </span>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div style={{ padding: '12px' }}>
                  <h4 style={{
                    fontSize: '13px', fontWeight: 700,
                    marginBottom: '3px',
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    lineHeight: 1.4, color: 'var(--text-primary)',
                  }}>{book.title}</h4>

                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    {book.author || 'Penulis tidak diketahui'}
                  </p>

                  {book.locations && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                      <MapPin size={10} color="var(--primary-dark)" />
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {book.locations.aisle} • {book.locations.rack}
                      </span>
                    </div>
                  )}

                  {book.category && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                      <Tag size={10} color="var(--text-muted)" />
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{book.category}</span>
                    </div>
                  )}

                  {book.stock > 0 && (
                    <div style={{
                      marginBottom: '8px',
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '3px 8px',
                      background: stockAvailable === 0 ? '#fef2f2' : 'var(--primary-pale)',
                      borderRadius: '20px', fontSize: '10px', fontWeight: 600,
                      color: stockAvailable === 0 ? '#ef4444' : 'var(--primary-dark)',
                    }}>
                      {stockAvailable === 0 ? 'Stok habis' : `Stok: ${stockAvailable}`}
                    </div>
                  )}

                  <button
                    className={`btn ${available && !isPendingByMe && !isBorrowedByMe ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    style={{ width: '100%', justifyContent: 'center', fontSize: '12px' }}
                    disabled={!available || isPendingByMe || isBorrowedByMe || borrowing === book.id || hasFine}
                    onClick={() => handleBorrow(book)}
                  >
                    {borrowing === book.id ? 'Memproses...' :
                      isPendingByMe ? 'Menunggu ACC' :
                      isBorrowedByMe ? 'Sedang Dipinjam' :
                      !available ? 'Tidak Tersedia' :
                      'Pinjam Buku'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}