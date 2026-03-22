import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { assertSupabaseConfigured, isSupabaseConfigured, supabase } from '../supabaseClient'
import { fetchProfileById } from '../services/profileService'
import type { AuthUser } from '../types'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  configError: string | null
  signIn: (email: string, password: string) => Promise<AuthUser>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function mapAuthUser(profile: Awaited<ReturnType<typeof fetchProfileById>>): AuthUser {
  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    name: profile.name,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [configError, setConfigError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setConfigError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.')
      setLoading(false)
      return
    }

    let isMounted = true

    async function applySession(session: Session | null) {
      if (!isMounted) {
        return
      }

      if (!session?.user) {
        setUser(null)
        setLoading(false)
        return
      }

      try {
        const profile = await fetchProfileById(session.user.id)

        if (!isMounted) {
          return
        }

        setUser(mapAuthUser(profile))
        setConfigError(null)
      } catch (profileError) {
        const nextError = profileError instanceof Error ? profileError.message : 'Unable to load the current profile'

        if (!isMounted) {
          return
        }

        setUser(null)
        setConfigError(nextError)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setConfigError(error.message)
        setLoading(false)
        return
      }

      void applySession(data.session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string) {
    assertSupabaseConfigured()
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setLoading(false)
      throw new Error(error.message)
    }

    if (!data.user) {
      setLoading(false)
      throw new Error('No authenticated user was returned by Supabase.')
    }

    const profile = await fetchProfileById(data.user.id)
    const nextUser = mapAuthUser(profile)
    setUser(nextUser)
    setLoading(false)
    return nextUser
  }

  async function signOut() {
    if (!isSupabaseConfigured) {
      setUser(null)
      return
    }

    const { error } = await supabase.auth.signOut()

    if (error) {
      throw new Error(error.message)
    }

    setUser(null)
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configError,
      signIn,
      signOut,
    }),
    [configError, loading, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}