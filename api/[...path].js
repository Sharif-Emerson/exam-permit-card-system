function normalizeBaseUrl(value) {
  return value.replace(/\/$/, '')
}

function getUpstreamBaseUrl() {
  const configuredBaseUrl = process.env.API_BASE_URL?.trim() || process.env.VITE_API_BASE_URL?.trim() || ''

  return configuredBaseUrl ? normalizeBaseUrl(configuredBaseUrl) : ''
}

function buildUpstreamUrl(requestUrl, upstreamBaseUrl) {
  const incomingUrl = new URL(requestUrl)
  const upstreamPath = incomingUrl.pathname.replace(/^\/api/, '') || '/'

  return new URL(`${upstreamPath}${incomingUrl.search}`, `${upstreamBaseUrl}/`)
}

function buildProxyHeaders(request) {
  const incomingUrl = new URL(request.url)
  const headers = new Headers(request.headers)

  headers.delete('host')
  headers.delete('content-length')
  headers.set('x-forwarded-host', incomingUrl.host)
  headers.set('x-forwarded-proto', incomingUrl.protocol.replace(':', ''))

  return headers
}

function buildResponseHeaders(upstreamHeaders) {
  const headers = new Headers(upstreamHeaders)

  headers.delete('connection')
  headers.delete('keep-alive')
  headers.delete('transfer-encoding')

  return headers
}

export default async function handler(request) {
  const upstreamBaseUrl = getUpstreamBaseUrl()

  if (!upstreamBaseUrl) {
    return Response.json(
      {
        message: 'API_BASE_URL is not configured for this deployment. Set it in Vercel so /api can proxy to your backend.',
      },
      { status: 500 },
    )
  }

  const method = request.method.toUpperCase()
  const upstreamUrl = buildUpstreamUrl(request.url, upstreamBaseUrl)
  const init = {
    method,
    headers: buildProxyHeaders(request),
    redirect: 'manual',
  }

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = await request.arrayBuffer()
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, init)

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: buildResponseHeaders(upstreamResponse.headers),
    })
  } catch {
    return Response.json(
      {
        message: `Unable to reach the REST API at ${upstreamBaseUrl}.`,
      },
      { status: 502 },
    )
  }
}