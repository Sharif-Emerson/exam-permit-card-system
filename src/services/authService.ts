import { requestWithApiFallback } from '../adapters/rest/request'

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