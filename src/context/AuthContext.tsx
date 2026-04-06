import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { activeAuthAdapter } from '../adapters/auth'
import type { AuthSession } from '../adapters/auth/types'
import { fetchProfileById } from '../services/profileService'
import type { AuthUser } from '../types'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  configError: string | null
  signIn: (email: string, password: string) => Promise<AuthUser>
  signInWithToken: (token: string) => Promise<AuthUser>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function mapAuthUser(profile: Awaited<ReturnType<typeof fetchProfileById>>, sessionUser?: AuthUser): AuthUser {
  const nextUser: AuthUser = {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    name: profile.name,
    phoneNumber: profile.phoneNumber,
  }

  if (nextUser.role === 'admin' && sessionUser?.role === 'admin') {
    nextUser.scope = sessionUser.scope
    nextUser.assistantRole = sessionUser.assistantRole
    nextUser.permissions = sessionUser.permissions ?? []
    if (sessionUser.firstLoginRequired) {
      nextUser.firstLoginRequired = true
    }
  }

  return nextUser
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [configError, setConfigError] = useState<string | null>(null)

  async function loadUserProfile(userId: string, sessionUser?: AuthUser) {
    const profile = await fetchProfileById(userId)
    const nextUser = mapAuthUser(profile, sessionUser)
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

    async function applySession(session: AuthSession | null) {
      if (!isMounted) {
        return
      }

      if (!session) {
        setUser(null)
        setLoading(false)
        return
      }

      try {
        const nextUser = await loadUserProfile(session.userId, session.user)

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
    const session = await activeAuthAdapter.signIn(email, password)
    setLoading(true)
    try {
      const nextUser = await loadUserProfile(session.userId, session.user)
      return nextUser
    } finally {
      setLoading(false)
    }
  }

  async function signInWithToken(token: string) {
    setLoading(true)
    try {
      const session = await activeAuthAdapter.signInWithToken(token)
      const nextUser = await loadUserProfile(session.userId, session.user)
      return nextUser
    } finally {
      setLoading(false)
    }
  }

  async function signOut() {
    setLoading(true)
    try {
      if (!activeAuthAdapter.isConfigured) {
        setUser(null)
        return
      }

      await activeAuthAdapter.signOut()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  async function refreshUser() {
    if (!user) {
      return
    }

    setLoading(true)

    try {
      const session = await activeAuthAdapter.getSession()
      if (session) {
        await loadUserProfile(session.userId, session.user)
      }
    } finally {
      setLoading(false)
    }
  }

  const value: AuthContextValue = {
    user,
    loading,
    configError,
    signIn,
    signInWithToken,
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