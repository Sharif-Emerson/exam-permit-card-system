import { apiBaseUrl } from '../../config/provider'
import { clearStoredAuthToken, getStoredAuthToken, setStoredAuthToken } from '../rest/tokenStorage'
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

async function parseJsonResponse(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''

  if (!contentType.includes('application/json')) {
    return null
  }

  return response.json()
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

async function authenticatedRequest(path: string, init?: RequestInit) {
  const token = getStoredAuthToken()
  const headers = new Headers(init?.headers)

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers })
  const payload = await parseJsonResponse(response)

  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
      ? payload.message
      : `Request failed with status ${response.status}`
    throw new Error(message)
  }

  return payload
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
      const userId = extractUserId(payload)
      return userId ? { userId } : null
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
      body: JSON.stringify({ email, password }),
    })

    const token = extractToken(payload)
    const userId = extractUserId(payload)

    if (!token || !userId) {
      throw new Error('The login API response is missing a token or user id.')
    }

    setStoredAuthToken(token)
    const session = { userId }
    notify(session)
    return session
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