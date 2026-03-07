import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null) // student data or admin flag
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState(null) // 'admin' | 'student'

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
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
      // Check if admin (email matches admin pattern or metadata)
      const isAdmin = authUser.user_metadata?.role === 'admin' ||
        authUser.email === import.meta.env.VITE_ADMIN_EMAIL

      if (isAdmin) {
        setRole('admin')
        setProfile({ email: authUser.email, name: 'Administrator' })
        setLoading(false)
        return
      }

      // Try to find student by email (NIS@school.com format)
      const nis = authUser.email.split('@')[0]
      const { data: student, error } = await supabase
        .from('students')
        .select('*, classes(id, name, teacher)')
        .eq('nis', nis)
        .single()

      if (error || !student) {
        // Fallback: search by student_id linked to auth
        const { data: studentByAuth } = await supabase
          .from('students')
          .select('*, classes(id, name, teacher)')
          .eq('auth_id', authUser.id)
          .single()

        if (studentByAuth) {
          setRole('student')
          setProfile(studentByAuth)
        } else {
          setRole('admin') // default to admin if no student found
          setProfile({ email: authUser.email, name: 'Administrator' })
        }
      } else {
        setRole('student')
        setProfile(student)
      }
    } catch (err) {
      console.error('Error fetching profile:', err)
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

  return (
    <AuthContext.Provider value={{ user, profile, role, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
