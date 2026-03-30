function normalizeValue(value) {
  return String(value ?? '').trim()
}

function normalizeUrl(value) {
  const raw = normalizeValue(value)
  if (!raw) return ''
  return raw.replace(/\/+$/, '')
}

export function getSisConfig() {
  return {
    provider: normalizeValue(process.env.SIS_PROVIDER) || 'custom',
    baseUrl: normalizeUrl(process.env.SIS_BASE_URL),
    studentsPath: normalizeValue(process.env.SIS_STUDENTS_PATH) || '/students',
    authType: normalizeValue(process.env.SIS_AUTH_TYPE) || 'bearer',
    apiKey: normalizeValue(process.env.SIS_API_KEY),
    timeoutMs: Number(process.env.SIS_TIMEOUT_MS ?? 15000) || 15000,
  }
}

export function isSisConfigured() {
  const config = getSisConfig()
  return Boolean(config.baseUrl && config.apiKey)
}

export function getSisStatus() {
  const config = getSisConfig()
  return {
    enabled: isSisConfigured(),
    provider: config.provider,
    baseUrl: config.baseUrl || null,
    studentsPath: config.studentsPath,
    authType: config.authType,
    hasApiKey: Boolean(config.apiKey),
    timeoutMs: config.timeoutMs,
    message: isSisConfigured()
      ? 'SIS connector is configured. Endpoint mapping can be finalized when the SIS contract is provided.'
      : 'SIS connector is in setup mode. Set SIS_BASE_URL and SIS_API_KEY to enable pull tests.',
  }
}

export async function previewSisConnection() {
  const config = getSisConfig()
  if (!isSisConfigured()) {
    return {
      ok: false,
      message: 'SIS connector is not configured yet.',
      status: null,
      sampleCount: 0,
    }
  }

  const endpoint = `${config.baseUrl}${config.studentsPath.startsWith('/') ? '' : '/'}${config.studentsPath}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

  try {
    const headers = config.authType === 'header'
      ? { 'X-SIS-Key': config.apiKey }
      : { Authorization: `Bearer ${config.apiKey}` }
    const response = await fetch(endpoint, { method: 'GET', headers, signal: controller.signal })
    let sampleCount = 0
    if (response.ok) {
      const payload = await response.json().catch(() => null)
      if (Array.isArray(payload)) sampleCount = payload.length
      else if (payload && Array.isArray(payload.items)) sampleCount = payload.items.length
    }
    return {
      ok: response.ok,
      message: response.ok ? 'SIS endpoint reachable.' : 'SIS endpoint responded with an error.',
      status: response.status,
      sampleCount,
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Unable to reach SIS endpoint.',
      status: null,
      sampleCount: 0,
    }
  } finally {
    clearTimeout(timeout)
  }
}
