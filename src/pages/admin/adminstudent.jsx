import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { Search, Plus, Users, X, Eye, UserCheck, UserX } from 'lucide-react'
import toast from 'react-hot-toast'

// Client khusus untuk signUp siswa — tidak akan mengganggu session admin
const supabaseSignUp = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

export default function AdminStudents() {
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', nis: '', password: '', class_id: '' })
  const [saving, setSaving] = useState(false)
  const [viewStudent, setViewStudent] = useState(null)
  const [studentStats, setStudentStats] = useState(null)

  useEffect(() => { fetchClasses() }, [])
  useEffect(() => { fetchStudents() }, [search, filterClass])

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('*').order('name')
    setClasses(data || [])
  }

  const fetchStudents = async () => {
    setLoading(true)
    let query = supabase
      .from('students')
      .select('*, classes(name, teacher)')
      .order('name')

    if (filterClass) query = query.eq('class_id', parseInt(filterClass))

    const { data, error } = await query
    if (error) {
      toast.error('Gagal memuat data siswa')
      setLoading(false)
      return
    }

    let result = data || []
    if (search) {
      const s = search.toLowerCase()
      result = result.filter(st =>
        st.name.toLowerCase().includes(s) ||
        st.nis?.toLowerCase().includes(s)
      )
    }
    setStudents(result)
    setLoading(false)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Nama wajib diisi')
    if (!form.nis.trim()) return toast.error('NIS wajib diisi')
    if (!form.password.trim()) return toast.error('Password wajib diisi')
    if (form.password.length < 6) return toast.error('Password minimal 6 karakter')

    setSaving(true)
    try {
      // Cek duplikat NIS
      const { data: existing } = await supabase
        .from('students')
        .select('id')
        .eq('nis', form.nis.trim())
        .maybeSingle()

      if (existing) {
        toast.error(`NIS "${form.nis}" sudah terdaftar`)
        setSaving(false)
        return
      }

      const email = `${form.nis.trim()}@perpustakaan.sch.id`

      // Buat akun auth menggunakan client terpisah (tidak ganggu session admin)
      const { data: signUpData, error: signUpError } = await supabaseSignUp.auth.signUp({
        email,
        password: form.password.trim(),
      })

      if (signUpError) throw new Error('Gagal buat akun: ' + signUpError.message)

      const authId = signUpData.user?.id
      if (!authId) throw new Error('Auth ID tidak ditemukan setelah registrasi')

      // Insert siswa ke tabel students dengan auth_id langsung
      const { error: insertError } = await supabase.from('students').insert({
        name: form.name.trim(),
        nis: form.nis.trim(),
        class_id: form.class_id ? parseInt(form.class_id) : null,
        auth_id: authId,
      })

      if (insertError) throw new Error('Gagal simpan data siswa: ' + insertError.message)

      toast.success(`✅ Siswa "${form.name}" berhasil ditambahkan!`, { duration: 4000 })
      setShowModal(false)
      setForm({ name: '', nis: '', password: '', class_id: '' })
      fetchStudents()

    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const viewStudentDetail = async (student) => {
    setViewStudent(student)
    setStudentStats(null)
    try {
      const [
        { data: transactions },
        { data: points },
        { data: badges },
      ] = await Promise.all([
        supabase.from('transactions')
          .select('*, books(title)')
          .eq('student_id', student.id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase.from('points_log')
          .select('points')
          .eq('student_id', student.id),
        supabase.from('badges')
          .select('*')
          .eq('student_id', student.id),
      ])
      const totalPoints = points?.reduce((sum, p) => sum + p.points, 0) || 0
      setStudentStats({ transactions: transactions || [], badges: badges || [], totalPoints })
    } catch (err) {
      console.error('Error loading student detail:', err)
    }
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Data Siswa</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{students.length} siswa terdaftar</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Tambah Siswa
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '16px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: '38px' }}
            placeholder="Cari nama atau NIS..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input"
          style={{ width: 'auto', minWidth: '160px' }}
          value={filterClass}
          onChange={e => setFilterClass(e.target.value)}
        >
          <option value="">Semua Kelas</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div className="spinner" />
          </div>
        ) : students.length === 0 ? (
          <div className="empty-state">
            <Users size={36} />
            <h3>Tidak ada siswa</h3>
            <p>Tambah siswa dengan tombol di atas</p>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nama Siswa</th>
                  <th>NIS / Email Login</th>
                  <th>Kelas</th>
                  <th>Wali Kelas</th>
                  <th>Status Akun</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{i + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: 'var(--primary-pale)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '14px', fontWeight: 700, color: 'var(--primary-dark)',
                          flexShrink: 0,
                        }}>
                          {s.name.charAt(0)}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{s.name}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{s.nis || '-'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {s.nis ? `${s.nis}@perpustakaan.sch.id` : ''}
                      </div>
                    </td>
                    <td style={{ fontSize: '13px' }}>{s.classes?.name || '-'}</td>
                    <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{s.classes?.teacher || '-'}</td>
                    <td>
                      {s.auth_id ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#15803d', background: '#dcfce7', padding: '3px 8px', borderRadius: '20px' }}>
                          <UserCheck size={11} /> Aktif
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#92400e', background: '#fef3c7', padding: '3px 8px', borderRadius: '20px' }}>
                          <UserX size={11} /> Belum Aktif
                        </span>
                      )}
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => viewStudentDetail(s)}>
                        <Eye size={13} /> Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: 700 }}>Tambah Siswa Baru</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Akun login siswa akan dibuat otomatis
                </p>
              </div>
              <button onClick={() => !saving && setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Nama */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Nama Lengkap *
                </label>
                <input
                  className="input"
                  placeholder="Nama lengkap siswa"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              {/* NIS */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  NIS (Nomor Induk Siswa) *
                </label>
                <input
                  className="input"
                  placeholder="Contoh: 2024001"
                  value={form.nis}
                  onChange={e => setForm(f => ({ ...f, nis: e.target.value }))}
                />
                {form.nis && (
                  <div style={{ marginTop: '6px', padding: '8px 12px', background: 'var(--bg-light)', borderRadius: '8px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📧</span>
                    <span>Email login: <strong>{form.nis}@perpustakaan.sch.id</strong></span>
                  </div>
                )}
              </div>

              {/* Password */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Password *
                </label>
                <input
                  className="input"
                  type="text"
                  placeholder="Minimal 6 karakter (contoh: sama dengan NIS)"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Beritahukan password ini kepada siswa. Siswa bisa menggantinya nanti.
                </p>
              </div>

              {/* Kelas */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Kelas
                </label>
                <select
                  className="input"
                  value={form.class_id}
                  onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}
                >
                  <option value="">Pilih kelas...</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Info box */}
              <div style={{ padding: '12px 14px', background: 'var(--primary-pale)', borderRadius: '10px', fontSize: '12px', color: 'var(--primary-dark)', lineHeight: 1.6 }}>
                <strong>📋 Ringkasan akun yang akan dibuat:</strong><br />
                Email: <strong>{form.nis ? `${form.nis}@perpustakaan.sch.id` : '—'}</strong><br />
                Password: <strong>{form.password || '—'}</strong>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                >
                  Batal
                </button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                      Membuat akun...
                    </span>
                  ) : 'Tambah Siswa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student Detail Modal */}
      {viewStudent && (
        <div className="modal-overlay" onClick={() => { setViewStudent(null); setStudentStats(null) }}>
          <div className="modal-box" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700, color: 'var(--primary-dark)' }}>
                  {viewStudent.name.charAt(0)}
                </div>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700 }}>{viewStudent.name}</h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    NIS: {viewStudent.nis} • {viewStudent.classes?.name || 'Tanpa kelas'}
                  </p>
                </div>
              </div>
              <button onClick={() => { setViewStudent(null); setStudentStats(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {!studentStats ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                  <div className="spinner" />
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                    {[
                      { label: 'Total Buku', val: studentStats.transactions.length, color: 'var(--primary)' },
                      { label: 'Total Poin', val: studentStats.totalPoints, color: '#f59e0b' },
                      { label: 'Badge', val: studentStats.badges.length, color: '#8b5cf6' },
                    ].map((s, i) => (
                      <div key={i} className="card" style={{ flex: 1, padding: '14px', textAlign: 'center' }}>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {studentStats.badges.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Badge</h4>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {studentStats.badges.map((b, i) => (
                          <span key={i} style={{ padding: '6px 12px', background: 'var(--primary-pale)', borderRadius: '20px', fontSize: '12px', fontWeight: 600, color: 'var(--primary-dark)' }}>
                            {b.badge_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Riwayat Peminjaman</h4>
                  {studentStats.transactions.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Belum ada riwayat peminjaman</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                      {studentStats.transactions.map(t => (
                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-light)', borderRadius: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 500 }}>{t.books?.title || '-'}</span>
                          <span className={`badge-chip ${t.status}`} style={{ fontSize: '10px', flexShrink: 0 }}>
                            {{ borrowed: 'Dipinjam', returned: 'Dikembalikan', late: 'Terlambat', pending: 'Pending' }[t.status] || t.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
