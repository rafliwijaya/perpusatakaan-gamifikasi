// adminstudent.jsx

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { Search, Plus, Users, X, Eye, UserCheck, UserX, GraduationCap, School } from 'lucide-react'
import toast from 'react-hot-toast'

const supabaseSignUp = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

// TAB SISWA 
function TabSiswa({ classes }) {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', nis: '', password: '', class_id: '' })
  const [saving, setSaving] = useState(false)
  const [viewStudent, setViewStudent] = useState(null)
  const [studentStats, setStudentStats] = useState(null)

  useEffect(() => { fetchStudents() }, [search, filterClass])

  const fetchStudents = async () => {
    setLoading(true)
    let query = supabase.from('students').select('*, classes(name, teacher)').order('name')
    if (filterClass) query = query.eq('class_id', parseInt(filterClass))
    const { data, error } = await query
    if (error) { toast.error('Gagal memuat data siswa'); setLoading(false); return }
    let result = data || []
    if (search) {
      const s = search.toLowerCase()
      result = result.filter(st => st.name.toLowerCase().includes(s) || st.nis?.toLowerCase().includes(s))
    }
    setStudents(result)
    setLoading(false)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Nama wajib diisi')
    if (!form.nis.trim()) return toast.error('NIS wajib diisi')
    if (!form.password.trim() || form.password.length < 6) return toast.error('Password minimal 6 karakter')
    setSaving(true)
    try {
      const { data: existing } = await supabase.from('students').select('id').eq('nis', form.nis.trim()).maybeSingle()
      if (existing) { toast.error(`NIS "${form.nis}" sudah terdaftar`); return }

      const email = `${form.nis.trim()}@perpustakaan.sch.id`
      const { data: signUpData, error: signUpError } = await supabaseSignUp.auth.signUp({ email, password: form.password.trim() })
      if (signUpError) throw new Error('Gagal buat akun: ' + signUpError.message)

      const authId = signUpData.user?.id
      if (!authId) throw new Error('Auth ID tidak ditemukan')

      const { error: insertError } = await supabase.from('students').insert({
        name: form.name.trim(), nis: form.nis.trim(),
        class_id: form.class_id ? parseInt(form.class_id) : null,
        auth_id: authId,
      })
      if (insertError) throw new Error('Gagal simpan: ' + insertError.message)

      toast.success(`✅ Siswa "${form.name}" berhasil ditambahkan!`)
      setShowModal(false)
      setForm({ name: '', nis: '', password: '', class_id: '' })
      fetchStudents()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const viewDetail = async (student) => {
    setViewStudent(student); setStudentStats(null)
    const [{ data: transactions }, { data: points }, { data: badges }] = await Promise.all([
      supabase.from('transactions').select('*, books(title)').eq('student_id', student.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('points_log').select('points').eq('student_id', student.id),
      supabase.from('badges').select('*').eq('student_id', student.id),
    ])
    setStudentStats({ transactions: transactions || [], badges: badges || [], totalPoints: points?.reduce((s, p) => s + p.points, 0) || 0 })
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{students.length} siswa terdaftar</p>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><Plus size={14} /> Tambah Siswa</button>
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input" style={{ paddingLeft: '36px' }} placeholder="Cari nama atau NIS..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: 'auto', minWidth: '150px' }} value={filterClass} onChange={e => setFilterClass(e.target.value)}>
          <option value="">Semua Kelas</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="card">
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner" /></div>
          : students.length === 0 ? <div className="empty-state"><Users size={36} /><h3>Tidak ada siswa</h3></div>
          : (
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead><tr><th>#</th><th>Nama</th><th>NIS</th><th>Kelas</th><th>Wali Kelas</th><th>Status</th><th>Aksi</th></tr></thead>
                <tbody>
                  {students.map((s, i) => (
                    <tr key={s.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{i + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--primary-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--primary-dark)', flexShrink: 0 }}>{s.name.charAt(0)}</div>
                          <span style={{ fontWeight: 600, fontSize: '13px' }}>{s.name}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: '13px', fontFamily: 'monospace' }}>{s.nis || '-'}</td>
                      <td style={{ fontSize: '13px' }}>{s.classes?.name || '-'}</td>
                      <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{s.classes?.teacher || '-'}</td>
                      <td>
                        {s.auth_id
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#15803d', background: '#dcfce7', padding: '3px 8px', borderRadius: '20px' }}><UserCheck size={11} /> Aktif</span>
                          : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#92400e', background: '#fef3c7', padding: '3px 8px', borderRadius: '20px' }}><UserX size={11} /> Belum Aktif</span>
                        }
                      </td>
                      <td><button className="btn btn-ghost btn-sm" onClick={() => viewDetail(s)}><Eye size={13} /> Detail</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><h2 style={{ fontSize: '17px', fontWeight: 700 }}>Tambah Siswa Baru</h2><p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Akun login dibuat otomatis</p></div>
              <button onClick={() => !saving && setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div><label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Nama Lengkap *</label><input className="input" placeholder="Nama lengkap siswa" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>NIS *</label>
                <input className="input" placeholder="Contoh: 2024001" value={form.nis} onChange={e => setForm(f => ({ ...f, nis: e.target.value }))} />
                {form.nis && <div style={{ marginTop: '6px', padding: '7px 12px', background: 'var(--bg-light)', borderRadius: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>📧 <strong>{form.nis}@perpustakaan.sch.id</strong></div>}
              </div>
              <div><label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Password *</label><input className="input" type="text" placeholder="Min. 6 karakter" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Kelas</label>
                <select className="input" value={form.class_id} onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}>
                  <option value="">Pilih kelas...</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.teacher ? ` — ${c.teacher}` : ''}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)} disabled={saving}>Batal</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                  {saving ? <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />Membuat...</span> : 'Tambah Siswa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewStudent && (
        <div className="modal-overlay" onClick={() => { setViewStudent(null); setStudentStats(null) }}>
          <div className="modal-box" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--primary-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700, color: 'var(--primary-dark)' }}>{viewStudent.name.charAt(0)}</div>
                <div><h2 style={{ fontSize: '16px', fontWeight: 700 }}>{viewStudent.name}</h2><p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>NIS: {viewStudent.nis} • {viewStudent.classes?.name}</p></div>
              </div>
              <button onClick={() => { setViewStudent(null); setStudentStats(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              {!studentStats ? <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><div className="spinner" /></div> : (
                <>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                    {[{ label: 'Total Buku', val: studentStats.transactions.length, color: 'var(--primary)' }, { label: 'Total Poin', val: studentStats.totalPoints, color: '#f59e0b' }, { label: 'Badge', val: studentStats.badges.length, color: '#8b5cf6' }].map((s, i) => (
                      <div key={i} className="card" style={{ flex: 1, padding: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Riwayat Peminjaman</h4>
                  {studentStats.transactions.length === 0 ? <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Belum ada riwayat</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                      {studentStats.transactions.map(t => (
                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-light)', borderRadius: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 500 }}>{t.books?.title || '-'}</span>
                          <span className={`badge-chip ${t.status}`} style={{ fontSize: '10px' }}>{{ borrowed: 'Dipinjam', returned: 'Dikembalikan', late: 'Terlambat', pending: 'Pending' }[t.status]}</span>
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
    </>
  )
}

// ─── TAB GURU ────────────────────────────
function TabGuru({ classes, onRefresh }) {
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', nip: '', password: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchTeachers() }, [])

  const fetchTeachers = async () => {
    setLoading(true)
    const { data } = await supabase.from('teachers').select('*').order('name')
    // Fetch nama kelas untuk setiap guru
    const teachersWithClass = await Promise.all((data || []).map(async (t) => {
      if (t.class_id) {
        const { data: kelas } = await supabase.from('classes').select('name').eq('id', t.class_id).maybeSingle()
        return { ...t, className: kelas?.name || null }
      }
      return { ...t, className: null }
    }))
    setTeachers(teachersWithClass)
    setLoading(false)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Nama wajib diisi')
    if (!form.nip.trim()) return toast.error('NIP wajib diisi')
    if (!form.password.trim() || form.password.length < 6) return toast.error('Password minimal 6 karakter')
    setSaving(true)
    try {
      const { data: existing } = await supabase.from('teachers').select('id').eq('nip', form.nip.trim()).maybeSingle()
      if (existing) { toast.error(`NIP "${form.nip}" sudah terdaftar`); return }

      const email = `${form.nip.trim()}@guru.perpustakaan.sch.id`
      const { data: signUpData, error: signUpError } = await supabaseSignUp.auth.signUp({ email, password: form.password.trim() })
      if (signUpError) throw new Error('Gagal buat akun: ' + signUpError.message)

      const authId = signUpData.user?.id
      if (!authId) throw new Error('Auth ID tidak ditemukan')

      const { error: insertError } = await supabase.from('teachers').insert({
        name: form.name.trim(), nip: form.nip.trim(), auth_id: authId, role: 'guru',
      })
      if (insertError) throw new Error('Gagal simpan: ' + insertError.message)

      toast.success(`✅ Guru "${form.name}" berhasil ditambahkan!`)
      setShowModal(false)
      setForm({ name: '', nip: '', password: '' })
      fetchTeachers()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{teachers.length} guru terdaftar</p>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><Plus size={14} /> Tambah Guru</button>
      </div>
      <div className="card">
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner" /></div>
          : teachers.length === 0 ? <div className="empty-state"><GraduationCap size={36} /><h3>Belum ada guru</h3></div>
          : (
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead><tr><th>#</th><th>Nama Guru</th><th>NIP</th><th>Email Login</th><th>Wali Kelas</th><th>Status</th></tr></thead>
                <tbody>
                  {teachers.map((t, i) => (
                    <tr key={t.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{i + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#3b82f6', flexShrink: 0 }}>{t.name.charAt(0)}</div>
                          <span style={{ fontWeight: 600, fontSize: '13px' }}>{t.name}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: '13px', fontFamily: 'monospace' }}>{t.nip || '-'}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t.nip}@guru.perpustakaan.sch.id</td>
                      <td style={{ fontSize: '13px' }}>{t.className || <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Belum ditugaskan</span>}</td>
                      <td>
                        {t.auth_id
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#15803d', background: '#dcfce7', padding: '3px 8px', borderRadius: '20px' }}><UserCheck size={11} /> Aktif</span>
                          : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#92400e', background: '#fef3c7', padding: '3px 8px', borderRadius: '20px' }}><UserX size={11} /> Belum Aktif</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><h2 style={{ fontSize: '17px', fontWeight: 700 }}>Tambah Guru Baru</h2><p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Akun login dibuat otomatis</p></div>
              <button onClick={() => !saving && setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div><label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Nama Lengkap *</label><input className="input" placeholder="Nama lengkap guru" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>NIP *</label>
                <input className="input" placeholder="Nomor Induk Pegawai" value={form.nip} onChange={e => setForm(f => ({ ...f, nip: e.target.value }))} />
                {form.nip && <div style={{ marginTop: '6px', padding: '7px 12px', background: '#eff6ff', borderRadius: '8px', fontSize: '11px', color: '#3b82f6' }}>📧 <strong>{form.nip}@guru.perpustakaan.sch.id</strong></div>}
              </div>
              <div><label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Password *</label><input className="input" type="text" placeholder="Min. 6 karakter" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)} disabled={saving}>Batal</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                  {saving ? <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />Membuat...</span> : 'Tambah Guru'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── TAB KELAS ───────────────────────────
function TabKelas({ onRefresh }) {
  const [classes, setClasses] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', teacher_id: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const [{ data: classData }, { data: teacherData }] = await Promise.all([
      supabase.from('classes').select('*').order('name'),
      supabase.from('teachers').select('id, name, nip').order('name'),
    ])
    setClasses(classData || [])
    setTeachers(teacherData || [])
    setLoading(false)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Nama kelas wajib diisi')
    setSaving(true)
    try {
      const selectedTeacher = form.teacher_id ? teachers.find(t => t.id === parseInt(form.teacher_id)) : null

      const { data: newClass, error } = await supabase.from('classes').insert({
        name: form.name.trim(),
        teacher: selectedTeacher?.name || null,
        teacher_id: selectedTeacher ? parseInt(form.teacher_id) : null,
      }).select().single()

      if (error) throw error

      // Update class_id di tabel teachers
      if (selectedTeacher && newClass) {
        await supabase.from('teachers').update({ class_id: newClass.id }).eq('id', selectedTeacher.id)
      }

      toast.success(`✅ Kelas "${form.name}" berhasil ditambahkan!`)
      setShowModal(false)
      setForm({ name: '', teacher_id: '' })
      fetchData()
      onRefresh?.()
    } catch (err) {
      toast.error('Gagal: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{classes.length} kelas terdaftar</p>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><Plus size={14} /> Tambah Kelas</button>
      </div>
      <div className="card">
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner" /></div>
          : classes.length === 0 ? <div className="empty-state"><School size={36} /><h3>Belum ada kelas</h3></div>
          : (
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead><tr><th>#</th><th>Nama Kelas</th><th>Wali Kelas</th></tr></thead>
                <tbody>
                  {classes.map((c, i) => (
                    <tr key={c.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{i + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'var(--primary-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--primary-dark)' }}>{c.name.charAt(0)}</div>
                          <span style={{ fontWeight: 700, fontSize: '14px' }}>{c.name}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: '13px' }}>{c.teacher || <span style={{ color: 'var(--text-muted)' }}>Belum ada wali kelas</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700 }}>Tambah Kelas Baru</h2>
              <button onClick={() => !saving && setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div><label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Nama Kelas *</label><input className="input" placeholder="Contoh: 7A, 8B" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Wali Kelas</label>
                <select className="input" value={form.teacher_id} onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))}>
                  <option value="">Pilih guru wali kelas...</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name} (NIP: {t.nip})</option>)}
                </select>
                {teachers.length === 0 && <p style={{ fontSize: '11px', color: '#f59e0b', marginTop: '6px' }}>⚠️ Tambah guru dulu di tab Guru.</p>}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)} disabled={saving}>Batal</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Tambah Kelas'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── KOMPONEN UTAMA ───────────────────────
export default function AdminStudents() {
  const [activeTab, setActiveTab] = useState('siswa')
  const [classes, setClasses] = useState([])

  useEffect(() => { fetchClasses() }, [])

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('*').order('name')
    setClasses(data || [])
  }

  const tabs = [
    { id: 'siswa', label: 'Siswa', icon: Users },
    { id: 'guru', label: 'Guru', icon: GraduationCap },
    { id: 'kelas', label: 'Kelas', icon: School },
  ]

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Data Pengguna</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Kelola siswa, guru, dan kelas</p>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '9px 18px', borderRadius: 'var(--radius-sm)',
            border: '1.5px solid',
            borderColor: activeTab === id ? 'var(--primary)' : 'var(--border)',
            background: activeTab === id ? 'var(--primary)' : 'white',
            color: activeTab === id ? '#1a1f0e' : 'var(--text-secondary)',
            cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
            fontSize: '13px', fontWeight: 600, transition: 'all 0.15s',
          }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      {activeTab === 'siswa' && <TabSiswa classes={classes} />}
      {activeTab === 'guru' && <TabGuru classes={classes} onRefresh={fetchClasses} />}
      {activeTab === 'kelas' && <TabKelas onRefresh={fetchClasses} />}
    </div>
  )
}
