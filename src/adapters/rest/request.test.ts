import { describe, expect, it, vi, afterEach } from 'vitest'

vi.mock('../../config/provider', () => ({
  apiBaseUrlCandidates: ['/api'],
}))

import { requestWithApiFallback } from './request'

describe('requestWithApiFallback', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns an actionable message when the backend proxy responds with 502', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Bad Gateway', {
      status: 502,
      headers: {
        'content-type': 'text/plain',
      },
    }))

    await expect(requestWithApiFallback('/health')).rejects.toThrow(
      'The REST API is unavailable right now. Start the backend with "npm run dev:rest" or "npm run dev:rest:backend" and try again.',
    )
  })

  it('preserves server validation messages for non-gateway failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ message: 'A valid email address is required.' }), {
      status: 400,
      headers: {
        'content-type': 'application/json',
      },
    }))

    await expect(requestWithApiFallback('/profiles/student-1/account', {
      method: 'PATCH',
      body: JSON.stringify({ email: 'bad' }),
    })).rejects.toThrow('A valid email address is required.')
  })
})
