import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { activeAuthAdapter } from '../adapters/auth'
import { fetchProfileById } from '../services/profileService'
import type { AuthUser } from '../types'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  configError: string | null
  signIn: (email: string, password: string) => Promise<AuthUser>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
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

  async function loadUserProfile(userId: string) {
    const profile = await fetchProfileById(userId)
    const nextUser = mapAuthUser(profile)
    setUser(nextUser)
    setConfigError(null)
    return nextUser
  }

  useEffect(() => {
    const nextConfigError = activeAuthAdapter.getConfigError()

    if (!activeAuthAdapter.isConfigured || nextConfigError) {
      setConfigError(nextConfigError)
      setLoading(false)
      return
    }

    let isMounted = true

    async function applySession(session: { userId: string } | null) {
      if (!isMounted) {
        return
      }

      if (!session) {
        setUser(null)
        setLoading(false)
        return
      }

      try {
        const nextUser = await loadUserProfile(session.userId)

        if (!isMounted) {
          return
        }

        setUser(nextUser)
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

    void activeAuthAdapter.getSession().then((session) => {
      void applySession(session)
    }).catch((sessionError) => {
      if (!isMounted) {
        return
      }

      if (sessionError instanceof Error) {
        setConfigError(sessionError.message)
        setLoading(false)
      }
    })

    const unsubscribe = activeAuthAdapter.onAuthStateChange((session) => {
      void applySession(session)
    })

    return () => {
      isMounted = false

      if (typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [])

  async function signIn(email: string, password: string) {
    setLoading(true)

    const session = await activeAuthAdapter.signIn(email, password)
    const nextUser = await loadUserProfile(session.userId)
    setLoading(false)
    return nextUser
  }

  async function signOut() {
    if (!activeAuthAdapter.isConfigured) {
      setUser(null)
      return
    }

    await activeAuthAdapter.signOut()
    setUser(null)
  }

  async function refreshUser() {
    if (!user) {
      return
    }

    setLoading(true)

    try {
      await loadUserProfile(user.id)
    } finally {
      setLoading(false)
    }
  }

  const value: AuthContextValue = {
    user,
    loading,
    configError,
    signIn,
    signOut,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}