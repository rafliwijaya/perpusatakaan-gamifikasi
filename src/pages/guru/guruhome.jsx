import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/authcontext'
import { Search, MapPin, BookOpen, Tag, Filter, X, CheckCircle, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

export default function GuruHome() {
  const { profile } = useAuth()
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterType, setFilterType] = useState('')
  const [categories, setCategories] = useState([])
  const [borrowing, setBorrowing] = useState(null)
  const [activeBorrows, setActiveBorrows] = useState([])
  const [hasFine, setHasFine] = useState(false)
  const [borrowCountPerBook, setBorrowCountPerBook] = useState({})

  useEffect(() => {
    fetchBooks()
    fetchCategories()
    if (profile?.id) checkGuruStatus()
  }, [search, filterCategory, filterType, profile])

  const fetchCategories = async () => {
    const { data } = await supabase.from('books').select('category').not('category', 'is', null)
    setCategories([...new Set(data?.map(b => b.category).filter(Boolean))])
  }

  const checkGuruStatus = async () => {
    const sid = profile.student_id
    if (!sid) return

    const { data: borrows } = await supabase
      .from('transactions')
      .select('*')
      .eq('student_id', sid)
      .in('status', ['borrowed', 'late', 'pending'])
    setActiveBorrows(borrows || [])

    const { data: fines } = await supabase
      .from('transactions')
      .select('fine_amount')
      .eq('student_id', sid)
      .eq('status', 'late')
      .gt('fine_amount', 0)
    setHasFine(fines && fines.length > 0)
  }

  const fetchBooks = async () => {
    setLoading(true)
    let query = supabase.from('books').select('*, locations(aisle, rack)').order('title')
    if (search) query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%`)
    if (filterCategory) query = query.eq('category', filterCategory)
    if (filterType) query = query.eq('type', filterType)
    query = query.in('status', ['available', 'borrowed']).limit(60)
    const { data, error } = await query
    if (!error) {
      setBooks(data || [])
      fetchBorrowCounts(data || [])
    }
    setLoading(false)
  }

  const fetchBorrowCounts = async (bookList) => {
    if (!bookList.length) return
    const bookIds = bookList.map(b => b.id)
    const { data } = await supabase
      .from('transactions')
      .select('book_id')
      .in('book_id', bookIds)
      .in('status', ['borrowed', 'pending', 'late'])
    const counts = {}
    ;(data || []).forEach(t => {
      counts[t.book_id] = (counts[t.book_id] || 0) + 1
    })
    setBorrowCountPerBook(counts)
  }

  const handleBorrow = async (book) => {
    const sid = profile.student_id
    if (!sid) {
      toast.error('Akun guru belum terdaftar sebagai peminjam. Hubungi admin.')
      return
    }

    if (hasFine) return toast.error('Kamu memiliki denda yang belum dibayar.')

    // Maksimal 3 buku aktif
    const activeBorrowCount = activeBorrows.filter(b =>
      ['borrowed', 'pending', 'late'].includes(b.status)
    ).length
    if (activeBorrowCount >= 3) {
      toast.error('Kamu sudah meminjam 3 buku. Kembalikan buku terlebih dahulu.', { duration: 4000 })
      return
    }

    if (activeBorrows.find(b => b.book_id === book.id)) {
      return toast.error('Kamu sudah meminjam buku ini.')
    }
    if (book.status !== 'available') return toast.error('Buku sedang dipinjam.')

    setBorrowing(book.id)
    try {
      const { error: txError } = await supabase.from('transactions').insert({
        book_id: book.id,
        student_id: sid,
        class_id: null,
        status: 'pending',
        borrow_date: new Date().toISOString(),
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      if (txError) throw txError

      await supabase.from('books').update({ status: 'borrowed' }).eq('id', book.id)
      toast.success(`Permintaan pinjam "${book.title}" berhasil! Ambil di perpustakaan.`, { duration: 5000 })
      fetchBooks()
      checkGuruStatus()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBorrowing(null)
    }
  }

  const isPendingByMe = (book) => activeBorrows.some(b => b.book_id === book.id && b.status === 'pending')
  const isBorrowedByMe = (book) => activeBorrows.some(b => b.book_id === book.id && b.status === 'borrowed')
  const hasFilters = search || filterCategory || filterType

  return (
    <div className="fade-in">
      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
        borderRadius: 'var(--radius-xl)', padding: '28px 32px', marginBottom: '24px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Selamat datang</p>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'white', marginBottom: '4px' }}>
            {profile?.name || 'Guru'} 👋
          </h1>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
            NIP {profile?.nip} • Wali Kelas {profile?.classes?.name || '-'}
          </p>
          {hasFine && (
            <div style={{ marginTop: '12px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '10px', padding: '10px 16px', fontSize: '12px', color: '#fca5a5' }}>
              Kamu memiliki denda yang belum dibayar. Hubungi admin.
            </div>
          )}
        </div>
      </div>

      {/* Search & Filter */}
      <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input" style={{ paddingLeft: '44px' }} placeholder="Cari judul buku, penulis..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <Filter size={13} color="var(--text-muted)" />
          <select className="input" style={{ width: 'auto', fontSize: '12px', padding: '7px 12px' }} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">Semua Kategori</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input" style={{ width: 'auto', fontSize: '12px', padding: '7px 12px' }} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">Semua Tipe</option>
            <option value="teks">Teks</option>
            <option value="bergambar">Bergambar</option>
            <option value="campuran">Campuran</option>
          </select>
          {hasFilters && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFilterCategory(''); setFilterType('') }}>
              <X size={13} /> Reset
            </button>
          )}
        </div>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        {loading ? 'Memuat...' : `${books.length} buku ditemukan`}
      </p>

      {/* Books Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}><div className="spinner" /></div>
      ) : books.length === 0 ? (
        <div className="card empty-state"><BookOpen size={48} /><h3>Tidak ada buku</h3></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
          {books.map(book => {
            const pending = isPendingByMe(book)
            const borrowed = isBorrowedByMe(book)
            const activeBorrowCount = borrowCountPerBook[book.id] || 0
            const stockAvailable = book.stock > 0 ? Math.max(0, book.stock - activeBorrowCount) : null
            const available = book.status === 'available' && (book.stock === 0 || stockAvailable > 0)

            return (
              <div key={book.id} className="card" style={{ overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s', opacity: (!available && !pending && !borrowed) ? 0.72 : 1 }}
                onMouseEnter={e => { if (available) { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)' } }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
              >
                <div style={{ aspectRatio: '3/4', background: 'var(--primary-pale)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {book.cover_url ? (
                    <img src={book.cover_url} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <BookOpen size={48} color="var(--primary)" strokeWidth={1.5} />
                  )}
                  <div style={{ position: 'absolute', top: '8px', left: '8px' }}>
                    {pending ? (
                      <span style={{ background: '#fef3c7', color: '#d97706', padding: '3px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={9} /> Pending
                      </span>
                    ) : borrowed ? (
                      <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle size={9} /> Dipinjam
                      </span>
                    ) : available ? (
                      <span style={{ background: 'var(--primary)', color: '#1a1f0e', padding: '3px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700 }}>Tersedia</span>
                    ) : (
                      <span style={{ background: 'rgba(0,0,0,0.6)', color: 'white', padding: '3px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 600 }}>Tidak Tersedia</span>
                    )}
                  </div>
                </div>

                <div style={{ padding: '12px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '3px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4 }}>{book.title}</h4>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>{book.author || 'Penulis tidak diketahui'}</p>
                  {book.locations && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                      <MapPin size={10} color="var(--primary-dark)" />
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{book.locations.aisle} • {book.locations.rack}</span>
                    </div>
                  )}
                  {book.category && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '10px' }}>
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
                    className={`btn ${available && !pending && !borrowed ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    style={{ width: '100%', justifyContent: 'center', fontSize: '12px' }}
                    disabled={!available || pending || borrowed || borrowing === book.id || hasFine}
                    onClick={() => handleBorrow(book)}
                  >
                    {borrowing === book.id ? 'Memproses...' : pending ? 'Menunggu ACC' : borrowed ? '✓ Dipinjam' : !available ? 'Tidak Tersedia' : 'Pinjam'}
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
