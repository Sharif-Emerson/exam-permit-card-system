import { apiBaseUrl } from '../../config/provider'
import { requestWithApiFallback } from '../rest/request'
import { clearStoredAuthToken, getStoredAuthToken, setStoredAuthToken } from '../rest/tokenStorage'
import type { AuthUser } from '../../types'
import type { AuthAdapter, AuthSession } from './types'

const listeners = new Set<(session: AuthSession | null) => void>()

function notify(session: AuthSession | null) {
  for (const listener of listeners) {
    listener(session)
  }
}

function getConfigError() {
  return apiBaseUrl ? null : 'REST API is not configured. Add VITE_API_BASE_URL to your .env file.'
}

function extractUserId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const record = payload as Record<string, unknown>
  const nestedUser = record.user

  if (nestedUser && typeof nestedUser === 'object' && nestedUser !== null) {
    const nestedId = (nestedUser as Record<string, unknown>).id

    if (typeof nestedId === 'string') {
      return nestedId
    }
  }

  if (typeof record.userId === 'string') {
    return record.userId
  }

  if (typeof record.id === 'string') {
    return record.id
  }

  return null
}

function extractToken(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const record = payload as Record<string, unknown>

  if (typeof record.token === 'string') {
    return record.token
  }

  if (typeof record.accessToken === 'string') {
    return record.accessToken
  }

  if (typeof record.access_token === 'string') {
    return record.access_token
  }

  return null
}

function extractAuthUser(payload: unknown): AuthUser | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const record = payload as Record<string, unknown>
  const candidate = record.user && typeof record.user === 'object'
    ? record.user as Record<string, unknown>
    : record

  if (
    typeof candidate.id !== 'string'
    || typeof candidate.email !== 'string'
    || typeof candidate.role !== 'string'
    || typeof candidate.name !== 'string'
  ) {
    return null
  }

  if (candidate.role !== 'admin' && candidate.role !== 'student') {
    return null
  }

  const nextUser: AuthUser = {
    id: candidate.id,
    email: candidate.email,
    role: candidate.role,
    name: candidate.name,
  }

  if (candidate.role === 'admin') {
    if (
      candidate.scope === 'super-admin'
      || candidate.scope === 'registrar'
      || candidate.scope === 'finance'
      || candidate.scope === 'operations'
      || candidate.scope === 'assistant-admin'
    ) {
      nextUser.scope = candidate.scope
    }
    if (candidate.assistantRole === 'support_help' || candidate.assistantRole === 'department_prints') {
      nextUser.assistantRole = candidate.assistantRole
    }

    if (Array.isArray(candidate.permissions)) {
      nextUser.permissions = candidate.permissions.filter((permission): permission is NonNullable<AuthUser['permissions']>[number] => {
        return typeof permission === 'string'
      })
    }
  }

  return nextUser
}

async function authenticatedRequest(path: string, init?: RequestInit) {
  const token = getStoredAuthToken()
  const headers = new Headers(init?.headers)

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return requestWithApiFallback(path, { ...init, headers })
}

export const restAuthAdapter: AuthAdapter = {
  provider: 'rest',
  isConfigured: Boolean(apiBaseUrl),
  getConfigError,
  async getSession() {
    if (!apiBaseUrl) {
      return null
    }

    const token = getStoredAuthToken()

    if (!token) {
      return null
    }

    try {
      const payload = await authenticatedRequest('/auth/me', { method: 'GET' })
      const authUser = extractAuthUser(payload)
      const userId = authUser?.id ?? extractUserId(payload)
      return userId ? { userId, user: authUser ?? undefined } : null
    } catch {
      clearStoredAuthToken()
      return null
    }
  },
  onAuthStateChange(callback) {
    listeners.add(callback)

    return () => {
      listeners.delete(callback)
    }
  },
  async signIn(email, password) {
    if (!apiBaseUrl) {
      throw new Error(getConfigError() ?? 'REST API is not configured.')
    }

    const payload = await authenticatedRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: email, password }),
    })

    const token = extractToken(payload)
    const authUser = extractAuthUser(payload)
    const userId = authUser?.id ?? extractUserId(payload)

    if (!token || !userId) {
      throw new Error('The login API response is missing a token or user id.')
    }

    setStoredAuthToken(token)
    const session = { userId, user: authUser ?? undefined }
    return session
  },
  async signInWithToken(token) {
    if (!apiBaseUrl) {
      throw new Error(getConfigError() ?? 'REST API is not configured.')
    }

    const trimmed = token.trim()

    if (!trimmed) {
      throw new Error('No sign-in token was provided.')
    }

    setStoredAuthToken(trimmed)

    try {
      const payload = await authenticatedRequest('/auth/me', { method: 'GET' })
      const authUser = extractAuthUser(payload)
      const userId = authUser?.id ?? extractUserId(payload)

      if (!userId) {
        throw new Error('Unable to resolve the current user.')
      }

      const session = { userId, user: authUser ?? undefined }
      return session
    } catch {
      clearStoredAuthToken()
      notify(null)
      throw new Error('University sign-in failed or the session is invalid.')
    }
  },
  async signOut() {
    if (apiBaseUrl) {
      try {
        await authenticatedRequest('/auth/logout', { method: 'POST' })
      } catch {
        // Ignore logout API failures and clear the local token anyway.
      }
    }

    clearStoredAuthToken()
    notify(null)
  },
}