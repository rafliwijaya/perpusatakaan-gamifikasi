import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState(null)
  const fetchingRef = useRef(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        fetchingRef.current = false
        setUser(null); setProfile(null); setRole(null); setLoading(false)
        return
      }
      // Reset fetchingRef setiap SIGNED_IN agar bisa fetch ulang
      if (event === 'SIGNED_IN' && session?.user) {
        fetchingRef.current = false
        setUser(session.user)
        fetchProfile(session.user)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (authUser) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)

    try {
      // 1. Cek tabel admins
      const { data: adminData, error: adminErr } = await supabase
        .from('admins')
        .select('id, name, email, role')
        .eq('auth_id', authUser.id)
        .maybeSingle()

      if (adminErr) console.warn('admins query error:', adminErr.message)

      if (adminData) {
        setRole(adminData.role)
        setProfile({ id: adminData.id, name: adminData.name, email: adminData.email, role: adminData.role })
        return
      }

      // 2. Cek tabel teachers — query sederhana tanpa relasi kompleks
      const { data: teacherData, error: teacherErr } = await supabase
        .from('teachers')
        .select('id, name, nip, role, class_id')
        .eq('auth_id', authUser.id)
        .maybeSingle()

      if (teacherErr) console.warn('teachers query error:', teacherErr.message)

      if (teacherData) {
        // Fetch nama kelas secara terpisah jika ada class_id
        let kelasData = null
        if (teacherData.class_id) {
          const { data: kelas } = await supabase
            .from('classes')
            .select('id, name')
            .eq('id', teacherData.class_id)
            .maybeSingle()
          kelasData = kelas
        }
        setRole('guru')
        setProfile({ ...teacherData, role: 'guru', classes: kelasData })
        return
      }

      // 3. Cek tabel students — query sederhana tanpa relasi teachers
      const { data: studentData, error: studentErr } = await supabase
        .from('students')
        .select('id, name, nis, class_id, auth_id')
        .eq('auth_id', authUser.id)
        .maybeSingle()

      if (studentErr) console.warn('students query error:', studentErr.message)

      if (studentData) {
        // Fetch nama kelas secara terpisah
        let kelasData = null
        if (studentData.class_id) {
          const { data: kelas } = await supabase
            .from('classes')
            .select('id, name, teacher')
            .eq('id', studentData.class_id)
            .maybeSingle()
          kelasData = kelas
        }
        setRole('student')
        setProfile({ ...studentData, classes: kelasData })
        return
      }

      // 4. Ada error di semua query — jangan sign out, mungkin RLS
      if (adminErr || teacherErr || studentErr) {
        console.error('Semua query error, kemungkinan RLS bermasalah')
        // Biarkan user tetap, jangan sign out
        return
      }

      // 5. Benar-benar tidak ditemukan
      console.warn('User tidak ditemukan di sistem:', authUser.email)
      setUser(null); setProfile(null); setRole(null)
      await supabase.auth.signOut()

    } catch (err) {
      console.error('fetchProfile exception:', err.message)
      // Jangan sign out saat exception — bisa jadi network error
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  const signOut = async () => {
    fetchingRef.current = false
    setUser(null); setProfile(null); setRole(null)
    await supabase.auth.signOut()
  }

  const isAdmin = role === 'admin' || role === 'superadmin'
  const isSuperAdmin = role === 'superadmin'
  const isStudent = role === 'student'
  const isGuru = role === 'guru'

  return (
    <AuthContext.Provider value={{
      user, profile, role, loading,
      signIn, signOut,
      isAdmin, isSuperAdmin, isStudent, isGuru,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
