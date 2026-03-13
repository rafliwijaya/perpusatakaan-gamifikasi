import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Search, Plus, Users, X, Eye, Award } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminStudents() {
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', nis: '', class_id: '' })
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

    if (filterClass) query = query.eq('class_id', filterClass)

    const { data } = await query
    let result = data || []
    if (search) {
      const s = search.toLowerCase()
      result = result.filter(st => st.name.toLowerCase().includes(s) || st.nis?.toLowerCase().includes(s))
    }
    setStudents(result)
    setLoading(false)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.nis.trim()) return toast.error('Nama dan NIS wajib diisi')
    setSaving(true)
    try {
      const email = `${form.nis.trim()}@perpustakaan.sch.id`
      const password = form.nis.trim() // password default = NIS

      // Step 1: Daftarkan akun auth siswa menggunakan signUp biasa
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) throw authError

      const authId = authData.user?.id
      if (!authId) throw new Error('Gagal membuat akun auth')

      // Step 2: Insert data siswa ke tabel students
      const { error: insertError } = await supabase.from('students').insert({
        name: form.name.trim(),
        nis: form.nis.trim(),
        class_id: form.class_id || null,
        auth_id: authId,
      })

      if (insertError) throw insertError

      toast.success(
        `✅ Siswa "${form.name}" berhasil ditambahkan!\nEmail: ${email}\nPassword default: ${form.nis.trim()}`,
        { duration: 6000 }
      )
      setShowModal(false)
      setForm({ name: '', nis: '', class_id: '' })
      fetchStudents()
    } catch (err) {
      toast.error('Gagal: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const viewStudentDetail = async (student) => {
    setViewStudent(student)
    const [{ data: transactions }, { data: points }, { data: badges }] = await Promise.all([
      supabase.from('transactions').select('*, books(title)').eq('student_id', student.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('points_log').select('*').eq('student_id', student.id),
      supabase.from('badges').select('*').eq('student_id', student.id),
    ])
    const totalPoints = points?.reduce((sum, p) => sum + p.points, 0) || 0
    setStudentStats({ transactions: transactions || [], badges: badges || [], totalPoints })
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Data Siswa</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{students.length} siswa terdaftar</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Tambah Siswa
        </button>
      </div>

      <div className="card" style={{ padding: '16px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input" style={{ paddingLeft: '38px' }}
            placeholder="Cari nama atau NIS..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input" style={{ width: 'auto', minWidth: '160px' }}
          value={filterClass} onChange={e => setFilterClass(e.target.value)}>
          <option value="">Semua Kelas</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div className="spinner" />
          </div>
        ) : students.length === 0 ? (
          <div className="empty-state">
            <Users size={36} />
            <h3>Tidak ada siswa</h3>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nama Siswa</th>
                  <th>NIS</th>
                  <th>Kelas</th>
                  <th>Wali Kelas</th>
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
                    <td style={{ fontSize: '13px', fontFamily: 'monospace', letterSpacing: '0.04em' }}>{s.nis || '-'}</td>
                    <td style={{ fontSize: '13px' }}>{s.classes?.name || '-'}</td>
                    <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{s.classes?.teacher || '-'}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => viewStudentDetail(s)}
                      >
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
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700 }}>Tambah Siswa Baru</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Nama Lengkap *</label>
                <input className="input" placeholder="Nama siswa" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>NIS *</label>
                <input className="input" placeholder="Nomor Induk Siswa" value={form.nis} onChange={e => setForm(f => ({ ...f, nis: e.target.value }))} />
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Password login default siswa = NIS ini
                </p>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Kelas</label>
                <select className="input" value={form.class_id} onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}>
                  <option value="">Pilih kelas...</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Batal</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Tambah Siswa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student Detail Modal */}
      {viewStudent && studentStats && (
        <div className="modal-overlay" onClick={() => setViewStudent(null)}>
          <div className="modal-box" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700, color: 'var(--primary-dark)' }}>
                  {viewStudent.name.charAt(0)}
                </div>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700 }}>{viewStudent.name}</h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>NIS: {viewStudent.nis} • {viewStudent.classes?.name}</p>
                </div>
              </div>
              <button onClick={() => setViewStudent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {/* Stats */}
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

              {/* Badges */}
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

              {/* Transaction History */}
              <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Riwayat Peminjaman</h4>
              {studentStats.transactions.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Belum ada riwayat peminjaman</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {studentStats.transactions.map(t => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-light)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 500 }}>{t.books?.title || '-'}</span>
                      <span className={`badge-chip ${t.status}`} style={{ fontSize: '10px' }}>
                        {{ borrowed: 'Dipinjam', returned: 'Dikembalikan', late: 'Terlambat', pending: 'Pending' }[t.status]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
