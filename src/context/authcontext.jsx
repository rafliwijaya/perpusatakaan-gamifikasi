import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState(null) //  | 'superadmin' | 'guru' | 'student'
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
        setUser(null); setProfile(null); setRole(null); setLoading(false)
        return
      }
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (authUser) => {
    if (fetchingRef.current) return
    fetchingRef.current = true

    try {
      // 1. Cek tabel admins
      const { data: adminData } = await supabase
        .from('admins')
        .select('id, name, email, role')
        .eq('auth_id', authUser.id)
        .maybeSingle()

      if (adminData) {
        setRole(adminData.role)
        setProfile({ id: adminData.id, name: adminData.name, email: adminData.email, role: adminData.role })
        return
      }

      // 2. Cek tabel teachers
      const { data: teacherData } = await supabase
        .from('teachers')
        .select('id, name, nip, role, classes(id, name)')
        .eq('auth_id', authUser.id)
        .maybeSingle()

      if (teacherData) {
        setRole('guru')
        setProfile({ ...teacherData, role: 'guru' })
        return
      }

      // 3. Cek tabel students
      const { data: studentData } = await supabase
        .from('students')
        .select('id, name, nis, class_id, auth_id, classes(id, name, teacher_id, teachers(name))')
        .eq('auth_id', authUser.id)
        .maybeSingle()

      if (studentData) {
        setRole('student')
        setProfile(studentData)
        return
      }

      // 4. Tidak ditemukan — sign out
      console.warn('User tidak ditemukan:', authUser.id)
      setUser(null); setProfile(null); setRole(null)
      await supabase.auth.signOut()

    } catch (err) {
      console.error('fetchProfile error:', err.message)
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
