
import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

const { getSession, onAuthStateChange, signIn, signOut, fetchProfileById } = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  fetchProfileById: vi.fn(),
}))

describe('AuthProvider', () => {
  it('restores the session from the active auth adapter on startup', async () => {
    const authAdaptersModule = await import('../adapters/auth')
    authAdaptersModule.activeAuthAdapter.isConfigured = true
    authAdaptersModule.activeAuthAdapter.getConfigError = vi.fn(() => null)
    authAdaptersModule.activeAuthAdapter.getSession = getSession
    authAdaptersModule.activeAuthAdapter.onAuthStateChange = onAuthStateChange
    authAdaptersModule.activeAuthAdapter.signIn = signIn
    authAdaptersModule.activeAuthAdapter.signOut = signOut

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchProfileById').mockImplementation(fetchProfileById)

    const { AuthProvider, useAuth } = await import('./AuthContext')

    function Consumer() {
      const { user, loading } = useAuth()

      if (loading) {
        return <div>Loading</div>
      }

      return <div>{user ? `${user.name}:${user.role}` : 'No session'}</div>
    }

    getSession.mockResolvedValue({ userId: 'student-id' })
    onAuthStateChange.mockReturnValue(vi.fn())
    fetchProfileById.mockResolvedValue({
      id: 'student-id',
      email: 'student@example.com',
      role: 'student',
      name: 'John Doe',
    })

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('John Doe:student')).toBeTruthy()
    })
  })
})