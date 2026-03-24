import { apiBaseUrlCandidates } from '../../config/provider'

function isVercelPreviewHost() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.location.hostname.endsWith('.vercel.app')
}

function getDeploymentHint(path: string, status: number) {
  if (!path.startsWith('/auth/') && !path.startsWith('/profiles') && !path.startsWith('/permits/') && !path.startsWith('/admin-activity-logs') && !path.startsWith('/imports/')) {
    return null
  }

  if (!isVercelPreviewHost()) {
    return null
  }

  if (status !== 404 && status !== 405) {
    return null
  }

  return 'This Vercel preview is serving the frontend without a reachable REST API. Configure the built-in /api proxy with API_BASE_URL pointing at your deployed backend, or proxy /api to the backend from the same origin.'
}

async function parseJsonResponse(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''

  if (!contentType.includes('application/json')) {
    return null
  }

  return response.json()
}

function getUnavailableApiMessage(status: number) {
  if (status === 502 || status === 503 || status === 504) {
    return 'The REST API is unavailable right now. Start the backend with "npm run dev:rest" or "npm run dev:rest:backend" and try again.'
  }

  return null
}

function getErrorMessage(path: string, payload: unknown, status: number) {
  const deploymentHint = getDeploymentHint(path, status)

  if (deploymentHint) {
    return deploymentHint
  }

  const unavailableApiMessage = getUnavailableApiMessage(status)

  if (unavailableApiMessage) {
    return unavailableApiMessage
  }

  return payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
    ? payload.message
    : `Request failed with status ${status}`
}

export async function requestWithApiFallback(path: string, init?: RequestInit) {
  const candidates = apiBaseUrlCandidates.length > 0 ? apiBaseUrlCandidates : ['']
  const attemptedUrls: string[] = []
  let lastNetworkError: unknown = null
  const method = (init?.method ?? 'GET').toUpperCase()
  const nextInit: RequestInit = {
    ...init,
    cache: init?.cache ?? (method === 'GET' || method === 'HEAD' ? 'no-store' : undefined),
  }

  for (const baseUrl of candidates) {
    const requestUrl = `${baseUrl}${path}`
    attemptedUrls.push(requestUrl)

    try {
      const response = await fetch(requestUrl, nextInit)
      const payload = await parseJsonResponse(response)

      if (!response.ok) {
        throw new Error(getErrorMessage(path, payload, response.status))
      }

      return payload
    } catch (error) {
      if (error instanceof TypeError) {
        lastNetworkError = error
        continue
      }

      throw error
    }
  }

  const attemptedSummary = attemptedUrls.join(', ')
  const reason = lastNetworkError instanceof Error ? lastNetworkError.message : 'Network request failed.'
  throw new Error(`Unable to reach the REST API. Tried: ${attemptedSummary}. ${reason}`)
}