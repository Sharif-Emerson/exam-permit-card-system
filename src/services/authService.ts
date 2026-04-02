import { requestWithApiFallback } from '../adapters/rest/request'
import { getStoredAuthToken } from '../adapters/rest/tokenStorage'

export async function resetPassword(identifier: string, verification: string, newPassword: string) {
  const payload = await requestWithApiFallback('/auth/reset-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      identifier,
      verification,
      newPassword,
    }),
  })

  const message = payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
    ? payload.message
    : 'Password reset successful. You can now sign in with the new password.'

  return { message }
}

export async function completeAdminFirstLogin(values: { password: string; email?: string }): Promise<void> {
  const token = getStoredAuthToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  await requestWithApiFallback('/auth/admin-first-login', {
    method: 'PATCH',
    headers,
    body: JSON.stringify(values),
  })
}