export type BackendProvider = 'rest'

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''

function normalizeBaseUrl(value: string) {
  return value.replace(/\/$/, '')
}

function isLoopbackHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]'
}

function getHostnameFromBaseUrl(value: string) {
  try {
    return new URL(value).hostname
  } catch {
    return ''
  }
}

function isLoopbackBaseUrl(value: string) {
  const hostname = getHostnameFromBaseUrl(value)
  return Boolean(hostname) && isLoopbackHost(hostname)
}

function getSameOriginApiBaseUrl() {
  if (typeof window === 'undefined') {
    return ''
  }

  return '/api'
}

function getPublicDevApiBaseUrl() {
  if (typeof window === 'undefined') {
    return ''
  }

  const { hostname } = window.location

  if (!hostname) {
    return ''
  }

  if (isLoopbackHost(hostname)) {
    return 'http://localhost:4000'
  }

  // During local Vite development, mirror the host the browser used so LAN and hostname access work.
  if (import.meta.env.DEV) {
    return `http://${hostname}:4000`
  }

  return ''
}

function getConfiguredApiBaseUrls() {
  const normalizedConfiguredApiBaseUrl = normalizeBaseUrl(configuredApiBaseUrl)

  if (!normalizedConfiguredApiBaseUrl) {
    return [] as string[]
  }

  // A loopback URL only works on the same machine, so do not let it override the dev proxy.
  if (import.meta.env.DEV && isLoopbackBaseUrl(normalizedConfiguredApiBaseUrl)) {
    return [normalizedConfiguredApiBaseUrl]
  }

  return [normalizedConfiguredApiBaseUrl]
}

function getDefaultApiBaseUrls() {
  const publicDevApiBaseUrl = getPublicDevApiBaseUrl()
  const candidates = [] as string[]

  candidates.push(getSameOriginApiBaseUrl())

  candidates.push(...getConfiguredApiBaseUrls())

  if (publicDevApiBaseUrl) {
    candidates.push(publicDevApiBaseUrl)
  }

  return [...new Set(candidates.map(normalizeBaseUrl).filter(Boolean))]
}

function getPublicApiBaseUrl() {
  const normalizedConfiguredApiBaseUrl = normalizeBaseUrl(configuredApiBaseUrl)
  const publicDevApiBaseUrl = normalizeBaseUrl(getPublicDevApiBaseUrl())
  const sameOriginApiBaseUrl = normalizeBaseUrl(getSameOriginApiBaseUrl())

  if (!normalizedConfiguredApiBaseUrl) {
    return import.meta.env.DEV
      ? publicDevApiBaseUrl || sameOriginApiBaseUrl
      : sameOriginApiBaseUrl
  }

  if (import.meta.env.DEV && isLoopbackBaseUrl(normalizedConfiguredApiBaseUrl) && publicDevApiBaseUrl) {
    return publicDevApiBaseUrl
  }

  return normalizedConfiguredApiBaseUrl
}

export const publicApiBaseUrl = getPublicApiBaseUrl()

export const apiBaseUrlCandidates = getDefaultApiBaseUrls()

export const apiBaseUrl = apiBaseUrlCandidates[0] ?? ''

export const backendProvider: BackendProvider =
  'rest'