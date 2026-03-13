import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState(null) // 'admin' | 'superadmin' | 'student'

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user)
      } else {
        setUser(null)
        setProfile(null)
        setRole(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (authUser) => {
    try {
      // 1. Cek dulu apakah user ini ada di tabel admins
      const { data: adminData } = await supabase
        .from('admins')
        .select('*')
        .eq('auth_id', authUser.id)
        .single()

      if (adminData) {
        setRole(adminData.role) // 'admin' atau 'superadmin'
        setProfile({
          id: adminData.id,
          name: adminData.name,
          email: adminData.email,
          role: adminData.role,
        })
        setLoading(false)
        return
      }

      // 2. Bukan admin, cek di tabel students
      const { data: studentData } = await supabase
        .from('students')
        .select('*, classes(id, name, teacher)')
        .eq('auth_id', authUser.id)
        .single()

      if (studentData) {
        setRole('student')
        setProfile(studentData)
        setLoading(false)
        return
      }

      // 3. Tidak ditemukan di keduanya — sign out otomatis
      console.warn('User tidak ditemukan di admins maupun students:', authUser.id)
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      setRole(null)

    } catch (err) {
      console.error('Error fetchProfile:', err)
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const isAdmin = role === 'admin' || role === 'superadmin'
  const isSuperAdmin = role === 'superadmin'
  const isStudent = role === 'student'

  return (
    <AuthContext.Provider value={{
      user, profile, role,
      loading, signIn, signOut,
      isAdmin, isSuperAdmin, isStudent,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
