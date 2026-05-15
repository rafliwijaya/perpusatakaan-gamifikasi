import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Search, Edit2, Trash2, BookOpen, X, Upload, MapPin, Tag } from 'lucide-react'
import toast from 'react-hot-toast'

const emptyBook = {
  title: '', author: '', category: '', type: 'teks',
  location_id: '', status: 'available', cover_url: '', stock: 1
}

export default function AdminBooks() {
  const [books, setBooks] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editBook, setEditBook] = useState(null)
  const [form, setForm] = useState(emptyBook)
  const [saving, setSaving] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const fileRef = useRef()
  const PER_PAGE = 12
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [locationForm, setLocationForm] = useState({ aisle: '', rack: '' })
  const [savingLocation, setSavingLocation] = useState(false)

  useEffect(() => { fetchLocations() }, [])
  useEffect(() => { fetchBooks() }, [search, filterCategory, filterStatus, page])

  const fetchLocations = async () => {
    const { data } = await supabase.from('locations').select('*').order('aisle').order('rack')
    setLocations(data || [])
  }

  const fetchBooks = async () => {
    setLoading(true)
    let query = supabase.from('books').select('*, locations(aisle, rack)', { count: 'exact' })

    if (search) query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%`)
    if (filterCategory) query = query.eq('category', filterCategory)
    if (filterStatus) query = query.eq('status', filterStatus)

    query = query.order('created_at', { ascending: false })
      .range((page - 1) * PER_PAGE, page * PER_PAGE - 1)

    const { data, error, count } = await query
    if (!error) {
      setBooks(data || [])
      setTotal(count || 0)
    }
    setLoading(false)
  }

  const openAdd = () => {
    setForm(emptyBook)
    setEditBook(null)
    setShowModal(true)
  }

  const openEdit = (book) => {
    setForm({
      title: book.title, author: book.author || '', category: book.category || '',
      type: book.type || 'teks', location_id: book.location_id || '',
      status: book.status, cover_url: book.cover_url || '', stock: book.stock ?? 1,
    })
    setEditBook(book)
    setShowModal(true)
  }

  const handleCoverUpload = async (file) => {
    if (!file) return
    setUploadingCover(true)
    try {
      const ext = file.name.split('.').pop()
      const filename = `${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('book-covers')
        .upload(filename, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('book-covers').getPublicUrl(filename)
      setForm(f => ({ ...f, cover_url: publicUrl }))
      toast.success('Cover berhasil diupload')
    } catch (err) {
      toast.error('Gagal upload cover: ' + err.message)
    } finally {
      setUploadingCover(false)
    }
  }

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error('Judul buku wajib diisi')
    setSaving(true)
    try {
      const stockVal = parseInt(form.stock) || 0
      const payload = {
        title: form.title.trim(),
        author: form.author.trim() || null,
        category: form.category.trim() || null,
        type: form.type,
        location_id: form.location_id || null,
        status: form.status,
        cover_url: form.cover_url || null,
        stock: stockVal,
      }

      if (editBook) {
        const { error } = await supabase.from('books').update(payload).eq('id', editBook.id)
        if (error) throw error
        toast.success('Buku berhasil diperbarui')
      } else {
        const { error } = await supabase.from('books').insert(payload)
        if (error) throw error
        toast.success('Buku berhasil ditambahkan')
      }

      setShowModal(false)
      fetchBooks()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (book) => {
    if (!confirm(`Hapus buku "${book.title}"? Data tidak dapat dipulihkan.`)) return
    const { error } = await supabase.from('books').delete().eq('id', book.id)
    if (error) return toast.error(error.message)
    toast.success('Buku dihapus')
    fetchBooks()
  }

  const handleSaveLocation = async () => {
    if (!locationForm.aisle.trim()) return toast.error('Lorong wajib diisi')
    if (!locationForm.rack.trim()) return toast.error('Rak wajib diisi')
    setSavingLocation(true)
    try {
      const { error } = await supabase.from('locations').insert({
        aisle: locationForm.aisle.trim(),
        rack: locationForm.rack.trim(),
      })
      if (error) throw error
      toast.success(`✅ Lokasi ${locationForm.aisle} — ${locationForm.rack} berhasil ditambahkan!`)
      setShowLocationModal(false)
      setLocationForm({ aisle: '', rack: '' })
      fetchLocations() // refresh dropdown lokasi di form buku
    } catch (err) {
      toast.error('Gagal: ' + err.message)
    } finally {
      setSavingLocation(false)
    }
  }

  const categories = [...new Set(books.map(b => b.category).filter(Boolean))]
  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Manajemen Buku</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{total} buku tersedia</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => setShowLocationModal(true)}>
            <MapPin size={16} /> Tambah Lokasi
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Tambah Buku
          </button>
        </div>
      </div>

      {/* filters */}
      <div className="card" style={{ padding: '16px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: '38px' }}
            placeholder="Cari judul atau penulis..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <select
          className="input"
          style={{ width: 'auto', minWidth: '150px' }}
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
        >
          <option value="">Semua Status</option>
          <option value="available">Tersedia</option>
          <option value="borrowed">Dipinjam</option>
        </select>
        <select
          className="input"
          style={{ width: 'auto', minWidth: '150px' }}
          value={filterCategory}
          onChange={e => { setFilterCategory(e.target.value); setPage(1) }}
        >
          <option value="">Semua Kategori</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* books grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="spinner" />
        </div>
      ) : books.length === 0 ? (
        <div className="card empty-state">
          <BookOpen size={40} />
          <h3>Tidak ada buku</h3>
          <p>Coba ubah filter atau tambah buku baru</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {books.map(book => (
            <div key={book.id} className="card" style={{ overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
            >
              {/* Cover */}
              <div style={{
                height: '160px', background: 'var(--primary-pale)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', position: 'relative',
              }}>
                {book.cover_url ? (
                  <img src={book.cover_url} alt={book.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <BookOpen size={48} color="var(--primary)" strokeWidth={1.5} />
                )}
                <span className={`badge-chip ${book.status}`}
                  style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '10px' }}>
                  {book.status === 'available' ? 'Tersedia' : 'Dipinjam'}
                </span>
              </div>

              <div style={{ padding: '14px' }}>
                <h4 style={{
                  fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)',
                  marginBottom: '4px', overflow: 'hidden', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>{book.title}</h4>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  {book.author || 'Penulis tidak diketahui'}
                </p>

                {book.locations && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                    <MapPin size={11} color="var(--primary-dark)" />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {book.locations.aisle} • {book.locations.rack}
                    </span>
                  </div>
                )}

                {book.category && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Tag size={11} color="var(--text-muted)" />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{book.category}</span>
                  </div>
                )}

                {/* Stok info */}
                <div style={{
                  marginTop: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 10px',
                  background: book.stock === 0 ? '#fef2f2' : 'var(--primary-pale)',
                  borderRadius: '8px',
                }}>
                  <span style={{ fontSize: '11px', color: book.stock === 0 ? '#ef4444' : 'var(--primary-dark)', fontWeight: 600 }}>
                    Stok: {book.stock ?? 0}
                  </span>
                  <span style={{ fontSize: '10px', color: book.stock === 0 ? '#ef4444' : 'var(--text-muted)' }}>
                    {book.stock === 0 ? 'Habis' : 'Tersedia'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => openEdit(book)}>
                    <Edit2 size={12} /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(book)}
                    style={{
                      padding: '6px 10px', background: '#fef2f2', border: '1px solid #fecaca',
                      borderRadius: '6px', cursor: 'pointer', color: '#ef4444',
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              style={{
                width: '36px', height: '36px', borderRadius: '8px',
                border: '1.5px solid',
                borderColor: page === i + 1 ? 'var(--primary)' : 'var(--border)',
                background: page === i + 1 ? 'var(--primary)' : 'white',
                color: page === i + 1 ? '#1a1f0e' : 'var(--text-secondary)',
                cursor: 'pointer', fontFamily: 'Poppins', fontWeight: 600, fontSize: '13px',
              }}
            >{i + 1}</button>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>
                {editBook ? 'Edit Buku' : 'Tambah Buku Baru'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Cover Upload */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  Cover Buku
                </label>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{
                    width: '80px', height: '100px',
                    background: form.cover_url ? 'transparent' : 'var(--primary-pale)',
                    borderRadius: '8px', overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px dashed var(--border)',
                  }}>
                    {form.cover_url ? (
                      <img src={form.cover_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <BookOpen size={32} color="var(--primary)" strokeWidth={1.5} />
                    )}
                  </div>
                  <div>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => fileRef.current.click()}
                      disabled={uploadingCover}
                    >
                      <Upload size={13} />
                      {uploadingCover ? 'Mengupload...' : 'Upload Cover'}
                    </button>
                    <input
                      ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => handleCoverUpload(e.target.files[0])}
                    />
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                      JPG, PNG. Maks 2MB
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Judul Buku *</label>
                <input className="input" placeholder="Masukkan judul buku" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Penulis</label>
                <input className="input" placeholder="Nama penulis" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Kategori</label>
                  <input className="input" placeholder="Fiksi, Sains, dll" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Tipe Buku</label>
                  <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="teks">Teks</option>
                    <option value="bergambar">Bergambar</option>
                    <option value="campuran">Campuran</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Jumlah Stok *
                </label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  placeholder="Contoh: 3"
                  value={form.stock}
                  onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                />
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Jumlah eksemplar buku yang tersedia
                </p>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Lokasi Rak</label>
                <select className="input" value={form.location_id} onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))}>
                  <option value="">Pilih lokasi...</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.aisle} — {l.rack}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                <button
                  className="btn btn-secondary" style={{ flex: 1 }}
                  onClick={() => setShowModal(false)} disabled={saving}
                >Batal</button>
                <button
                  className="btn btn-primary" style={{ flex: 1 }}
                  onClick={handleSave} disabled={saving}
                >
                  {saving ? 'Menyimpan...' : editBook ? 'Simpan Perubahan' : 'Tambah Buku'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* modal tambah lokasi */}
      {showLocationModal && (
        <div className="modal-overlay" onClick={() => !savingLocation && setShowLocationModal(false)}>
          <div className="modal-box" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: 700 }}>Tambah Lokasi Rak</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Lokasi fisik buku di perpustakaan</p>
              </div>
              <button onClick={() => !savingLocation && setShowLocationModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Lorong *
                </label>
                <input
                  className="input"
                  placeholder="Contoh: Lorong A"
                  value={locationForm.aisle}
                  onChange={e => setLocationForm(f => ({ ...f, aisle: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Rak *
                </label>
                <input
                  className="input"
                  placeholder="Contoh: Rak 1"
                  value={locationForm.rack}
                  onChange={e => setLocationForm(f => ({ ...f, rack: e.target.value }))}
                />
              </div>

              {/* Preview lokasi yang dah ada */}
              {locations.length > 0 && (
                <div style={{ padding: '12px', background: 'var(--bg-light)', borderRadius: '8px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Lokasi yang sudah ada:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {locations.map(l => (
                      <span key={l.id} style={{ fontSize: '11px', padding: '3px 8px', background: 'white', border: '1px solid var(--border)', borderRadius: '20px', color: 'var(--text-secondary)' }}>
                        {l.aisle} • {l.rack}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowLocationModal(false)} disabled={savingLocation}>
                  Batal
                </button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveLocation} disabled={savingLocation}>
                  {savingLocation ? 'Menyimpan...' : 'Tambah Lokasi'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
