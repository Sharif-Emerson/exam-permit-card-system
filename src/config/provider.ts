export type BackendProvider = 'rest'

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''

function getDefaultApiBaseUrl() {
  if (typeof window === 'undefined') {
    return ''
  }

  const { hostname } = window.location
  return hostname === 'localhost' || hostname === '127.0.0.1' ? 'http://localhost:4000' : ''
}

export const apiBaseUrl = (configuredApiBaseUrl || getDefaultApiBaseUrl()).replace(/\/$/, '')

export const backendProvider: BackendProvider =
  'rest'