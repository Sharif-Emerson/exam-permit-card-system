export interface AuthSession {
  userId: string
}

export interface AuthAdapter {
  provider: string
  isConfigured: boolean
  getConfigError: () => string | null
  getSession: () => Promise<AuthSession | null>
  onAuthStateChange: (callback: (session: AuthSession | null) => void) => () => void
  signIn: (email: string, password: string) => Promise<AuthSession>
  signOut: () => Promise<void>
}